import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { stringArg } from "./args";
import { resolveInside } from "./paths";
import { NO_ROOT_MESSAGE, type Tool, type ToolResult } from "./types";

const MAX_MATCHES = 60;
const MAX_FILES = 400;
const MAX_FILE_BYTES = 512 * 1024;
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

export const fsGrepTool: Tool = {
  definition: {
    name: "fs_grep",
    description:
      "Search file contents with a regular expression inside the allowed root.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression" },
        path: { type: "string", description: "Relative directory path" },
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
      expression = new RegExp(pattern, "i");
    } catch {
      return { ok: false, content: "Invalid regular expression" };
    }

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
        visited += 1;
        const buffer = await readFile(absolute);
        if (buffer.subarray(0, 2000).includes(0)) {
          continue;
        }
        const lines = buffer.toString("utf8").split(/\r?\n/);
        const relativePath = path
          .relative(root, absolute)
          .split(path.sep)
          .join("/");
        for (let index = 0; index < lines.length; index += 1) {
          if (expression.test(lines[index])) {
            matches.push(
              `${relativePath}:${index + 1}: ${lines[index].trim().slice(0, 200)}`,
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
    const suffix = visited >= MAX_FILES ? "\n… (file limit reached)" : "";
    return { ok: true, content: matches.join("\n") + suffix };
  },
};
