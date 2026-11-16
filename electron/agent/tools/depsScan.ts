import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./types";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DEPS = 200;

interface Dependency {
  name: string;
  version: string;
}

function fromPackageLock(raw: string): Dependency[] | null {
  try {
    const data = JSON.parse(raw) as {
      packages?: Record<string, { version?: string; name?: string }>;
      dependencies?: Record<string, { version?: string }>;
    };
    const result: Dependency[] = [];
    if (data.packages) {
      for (const [key, entry] of Object.entries(data.packages)) {
        if (!key || !entry?.version) {
          continue;
        }
        const name = entry.name ?? key.split("node_modules/").pop() ?? key;
        result.push({ name, version: entry.version });
      }
      return result;
    }
    if (data.dependencies) {
      for (const [name, entry] of Object.entries(data.dependencies)) {
        if (entry?.version) {
          result.push({ name, version: entry.version });
        }
      }
      return result;
    }
  } catch {
    return null;
  }
  return null;
}

function fromPackageJson(raw: string): Dependency[] | null {
  try {
    const data = JSON.parse(raw) as Record<string, Record<string, string>>;
    const groups = ["dependencies", "devDependencies", "peerDependencies"];
    const result: Dependency[] = [];
    for (const group of groups) {
      for (const [name, version] of Object.entries(data[group] ?? {})) {
        result.push({ name, version });
      }
    }
    return result.length ? result : null;
  } catch {
    return null;
  }
}

function fromCycloneDx(raw: string): Dependency[] | null {
  try {
    const data = JSON.parse(raw) as {
      bomFormat?: string;
      components?: Array<{ name?: string; version?: string }>;
    };
    if (data.bomFormat !== "CycloneDX" || !Array.isArray(data.components)) {
      return null;
    }
    return data.components
      .filter((component) => component.name)
      .map((component) => ({
        name: component.name ?? "",
        version: component.version ?? "unspecified",
      }));
  } catch {
    return null;
  }
}

function fromPoetryLock(raw: string): Dependency[] | null {
  const result: Dependency[] = [];
  const blocks = raw.split(/\[\[package\]\]/).slice(1);
  for (const block of blocks) {
    const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
    const version = block.match(/version\s*=\s*"([^"]+)"/)?.[1];
    if (name) {
      result.push({ name, version: version ?? "unspecified" });
    }
  }
  return result.length ? result : null;
}

function fromRequirements(raw: string): Dependency[] | null {
  const result: Dependency[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z0-9_.-]+)\s*==\s*([^\s;#]+)/);
    if (match) {
      result.push({ name: match[1], version: match[2] });
    }
  }
  return result.length ? result : null;
}

function fromPom(raw: string): Dependency[] | null {
  const result: Dependency[] = [];
  const blocks = raw.split(/<dependency>/).slice(1);
  for (const block of blocks) {
    const name = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
    const version = block.match(/<version>([^<]+)<\/version>/)?.[1];
    if (name) {
      result.push({ name, version: version ?? "unspecified" });
    }
  }
  return result.length ? result : null;
}

function detect(
  fileName: string,
  raw: string,
): { format: string; dependencies: Dependency[] } | null {
  const lower = fileName.toLowerCase();
  const candidates: Array<[string, () => Dependency[] | null]> = [
    ["package-lock", () => fromPackageLock(raw)],
    ["package.json", () => fromPackageJson(raw)],
    ["cyclonedx", () => fromCycloneDx(raw)],
    ["poetry.lock", () => fromPoetryLock(raw)],
    ["requirements", () => fromRequirements(raw)],
    ["pom.xml", () => fromPom(raw)],
  ];

  for (const [format, parse] of candidates) {
    if (lower.includes(format)) {
      const dependencies = parse();
      if (dependencies) {
        return { format, dependencies };
      }
    }
  }

  for (const [format, parse] of candidates.slice(0, 3)) {
    const dependencies = parse();
    if (dependencies) {
      return { format, dependencies };
    }
  }
  return null;
}

export const depsScanTool: Tool = {
  definition: {
    name: "deps_scan",
    description:
      "Parse the workspace library artifact (lockfile or SBOM) and list resolved dependencies with versions.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  async execute(_args, context): Promise<ToolResult> {
    if (!context.libraryArtifactPath) {
      return {
        ok: false,
        content: "This workspace has no library artifact.",
      };
    }

    const fileName = path.basename(context.libraryArtifactPath);
    let raw: string;
    try {
      const buffer = await readFile(context.libraryArtifactPath);
      if (buffer.length > MAX_FILE_BYTES) {
        return { ok: false, content: "The artifact is larger than 5 MB." };
      }
      raw = buffer.toString("utf8");
    } catch (error) {
      return {
        ok: false,
        content: `Could not read the artifact: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const parsed = detect(fileName, raw);
    if (!parsed) {
      return {
        ok: false,
        content: `Unsupported artifact format: ${fileName}. Supported: package-lock.json, package.json, poetry.lock, requirements.txt, pom.xml, CycloneDX JSON.`,
      };
    }

    const unique = new Map<string, string>();
    for (const dependency of parsed.dependencies) {
      if (!unique.has(dependency.name)) {
        unique.set(dependency.name, dependency.version);
      }
    }

    const entries = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b));
    const shown = entries.slice(0, MAX_DEPS);
    const lines = shown.map(([name, version]) => `${name}@${version}`);
    const suffix =
      entries.length > MAX_DEPS
        ? `\n… (${entries.length - MAX_DEPS} more dependencies omitted)`
        : "";

    return {
      ok: true,
      content: `format: ${parsed.format}\ndependencies: ${entries.length}\n\n${lines.join("\n")}${suffix}`,
    };
  },
};
