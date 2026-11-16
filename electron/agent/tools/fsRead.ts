import { readFile, stat } from "node:fs/promises";
import { stringArg } from "./args";
import { resolveInside } from "./paths";
import { NO_ROOT_MESSAGE, type Tool, type ToolResult } from "./types";

const MAX_READ_CHARS = 20000;

export const fsReadTool: Tool = {
  definition: {
    name: "fs_read",
    description: "Read a UTF-8 text file inside the allowed root.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },

  async execute(args, context): Promise<ToolResult> {
    if (!context.root) {
      return { ok: false, content: NO_ROOT_MESSAGE };
    }
    const relative = stringArg(args, "path");
    if (!relative) {
      return { ok: false, content: "Missing argument: path" };
    }

    const target = resolveInside(context.root, relative);
    const info = await stat(target);
    if (!info.isFile()) {
      return { ok: false, content: "Not a file" };
    }

    const buffer = await readFile(target);
    if (buffer.subarray(0, 4000).includes(0)) {
      return { ok: false, content: "Binary file" };
    }

    const text = buffer.toString("utf8");
    return {
      ok: true,
      content:
        text.length > MAX_READ_CHARS
          ? `${text.slice(0, MAX_READ_CHARS)}\n… (truncated, ${text.length} characters total)`
          : text,
    };
  },
};
