import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { stringArg } from "./args";
import { resolveInside } from "./paths";
import { NO_ROOT_MESSAGE, type Tool, type ToolResult } from "./types";

const MAX_MATCHES = 40;
const MAX_FILES = 400;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PREVIEW_CHARS = 180;
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandBraces(value: string): string[] {
  const match = value.match(/\{([^{}]+)\}/);
  if (!match) {
    return [value];
  }
  const before = value.slice(0, match.index ?? 0);
  const after = value.slice((match.index ?? 0) + match[0].length);
  return match[1]
    .split(",")
    .flatMap((option) => expandBraces(`${before}${option.trim()}${after}`));
}

function globToRegExp(glob: string): RegExp {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*") {
      if (glob[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`${source}$`, "i");
}

function includesFile(relativePath: string, name: string, patterns: RegExp[]): boolean {
  if (patterns.length === 0) {
    return true;
  }
  return patterns.some(
    (pattern) => pattern.test(relativePath) || pattern.test(name),
  );
}


export const fsGrepTool: Tool = {
  definition: {
    name: "fs_grep",
    description:
      "Search file contents with a regular expression or literal text inside the allowed root. Use path and include to narrow the search, then read only the matching range with fs_read.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression or literal text" },
        path: { type: "string", description: "Relative file or directory path" },
        include: {
          type: "string",
          description: 'Glob filter such as "*.ts", "*.{ts,tsx}" or "src/**/*.ts". Comma-separated values are accepted.',
        },
        literal: {
          type: "boolean",
          description: "Treat pattern as exact text instead of a regular expression.",
        },
        caseSensitive: {
          type: "boolean",
          description: "Use case-sensitive matching. Defaults to false.",
        },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.root) {
      return { ok: false, content: NO_ROOT_MESSAGE };
    }
    const root = context.root;
    const pattern = stringArg(args, "pattern");
    if (!pattern) {
      return { ok: false, content: "Missing argument: pattern" };
    }

    let expression: RegExp;
    try {
      const literal = args.literal === true;
      const caseSensitive = args.caseSensitive === true;
      expression = new RegExp(
        literal ? escapeRegExp(pattern) : pattern,
        caseSensitive ? "" : "i",
      );
    } catch {
      return { ok: false, content: "Invalid regular expression" };
    }

    const include = stringArg(args, "include");
    const includePatterns = include
      ? include
          .split(",")
          .flatMap((entry) => expandBraces(entry.trim()))
          .filter(Boolean)
          .map(globToRegExp)
      : [];

    const base = resolveInside(root, stringArg(args, "path") ?? ".");
    const matches: string[] = [];
    let visited = 0;

    async function walk(current: string): Promise<void> {
      if (matches.length >= MAX_MATCHES || visited >= MAX_FILES) {
        return;
      }
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= MAX_MATCHES || visited >= MAX_FILES) {
          return;
        }
        if (entry.name.startsWith(".") || SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const info = await stat(absolute);
        if (info.size > MAX_FILE_BYTES) {
          continue;
        }
        const relativePath = path
          .relative(root, absolute)
          .split(path.sep)
          .join("/");
        if (!includesFile(relativePath, entry.name, includePatterns)) {
          continue;
        }
        visited += 1;
        const buffer = await readFile(absolute);
        if (buffer.subarray(0, 2000).includes(0)) {
          continue;
        }
        const lines = buffer.toString("utf8").split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
          if (expression.test(lines[index])) {
            matches.push(
              `${relativePath}:${index + 1}: ${lines[index].trim().slice(0, MAX_PREVIEW_CHARS)}`,
            );
            if (matches.length >= MAX_MATCHES) {
              return;
            }
          }
        }
      }
    }

    await walk(base);
    if (matches.length === 0) {
      return { ok: true, content: "No matches." };
    }
    const suffix =
      matches.length >= MAX_MATCHES
        ? "\n… (match limit reached; narrow the pattern or path)"
        : visited >= MAX_FILES
          ? "\n… (file limit reached)"
          : "";
    return { ok: true, content: matches.join("\n") + suffix };
  },
};
