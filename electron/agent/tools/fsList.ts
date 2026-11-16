import { readdir } from "node:fs/promises";
import { stringArg } from "./args";
import { resolveInside } from "./paths";
import { NO_ROOT_MESSAGE, type Tool, type ToolResult } from "./types";

const MAX_ENTRIES = 200;

export const fsListTool: Tool = {
  definition: {
    name: "fs_list",
    description:
      "List a directory inside the allowed root. Use '.' for the root.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path" },
      },
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.root) {
      return { ok: false, content: NO_ROOT_MESSAGE };
    }
    const target = resolveInside(context.root, stringArg(args, "path") ?? ".");
    const entries = await readdir(target, { withFileTypes: true });
    const visible = entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort(
        (a, b) =>
          Number(b.isDirectory()) - Number(a.isDirectory()) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, MAX_ENTRIES)
      .map((entry) => `${entry.isDirectory() ? "dir " : "file"}\t${entry.name}`);

    if (visible.length === 0) {
      return { ok: true, content: "(empty directory)" };
    }
    return { ok: true, content: visible.join("\n") };
  },
};
