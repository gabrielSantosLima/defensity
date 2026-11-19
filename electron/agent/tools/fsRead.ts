import { readFile, stat } from "node:fs/promises";
import { stringArg } from "./args";
import { resolveInside } from "./paths";
import { NO_ROOT_MESSAGE, type Tool, type ToolResult } from "./types";

const DEFAULT_LINES = 120;
const MAX_LINES = 300;
const MAX_READ_CHARS = 10_000;
const MAX_LINE_CHARS = 1_200;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function integerArg(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
): number | null {
  if (args[key] === undefined) {
    return fallback;
  }
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

function clampLine(line: string): string {
  if (line.length <= MAX_LINE_CHARS) {
    return line;
  }
  return `${line.slice(0, MAX_LINE_CHARS)} … (line truncated)`;
}

export const fsReadTool: Tool = {
  definition: {
    name: "fs_read",
    description:
      "Read a UTF-8 text file inside the allowed root in a line range. Returns 1-based line numbers and a next offset when the file continues. Use fs_grep first to find the relevant lines, then read a small range instead of whole large files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
        offset: {
          type: "integer",
          minimum: 1,
          description: "First line to read (1-based). Defaults to 1.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LINES,
          description: `Maximum number of lines to read. Defaults to ${DEFAULT_LINES}, capped at ${MAX_LINES}.`,
        },
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

    const offset = integerArg(args, "offset", 1);
    if (offset === null) {
      return { ok: false, content: "offset must be a positive integer" };
    }
    const requestedLimit = integerArg(args, "limit", DEFAULT_LINES);
    if (requestedLimit === null) {
      return { ok: false, content: "limit must be a positive integer" };
    }
    const limit = Math.min(requestedLimit, MAX_LINES);

    const target = resolveInside(context.root, relative);
    const info = await stat(target);
    if (!info.isFile()) {
      return { ok: false, content: "Not a file" };
    }
    if (info.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        content: `File is ${Math.round(info.size / 1024 / 1024)} MB. Use fs_grep to locate a section, then read a narrower file.`,
      };
    }

    const buffer = await readFile(target);
    if (buffer.subarray(0, 4000).includes(0)) {
      return { ok: false, content: "Binary file" };
    }

    const text = buffer.toString("utf8");
    if (!text) {
      return { ok: true, content: `(empty file: ${relative})` };
    }
    const rawLines = text.split(/\r?\n/);
    const lines =
      rawLines.length > 1 && rawLines.at(-1) === ""
        ? rawLines.slice(0, -1)
        : rawLines;
    const total = lines.length;
    const start = offset - 1;
    if (start >= total) {
      return {
        ok: false,
        content: `Offset ${offset} is beyond the end of the file (${total} lines).`,
      };
    }

    const width = String(Math.min(total, start + limit)).length;
    const selected: string[] = [];
    let chars = 0;
    let end = start;
    for (let index = start; index < lines.length; index += 1) {
      if (selected.length >= limit) {
        break;
      }
      const line = clampLine(lines[index]);
      const rendered = `${String(index + 1).padStart(width, " ")}: ${line}`;
      if (selected.length > 0 && chars + rendered.length + 1 > MAX_READ_CHARS) {
        break;
      }
      selected.push(rendered);
      chars += rendered.length + 1;
      end = index + 1;
    }

    const nextOffset = end < total ? end + 1 : null;
    const header = `${relative} · lines ${start + 1}-${end} of ${total}`;
    const footer =
      nextOffset === null
        ? ""
        : `\n… continue with offset=${nextOffset}`;
    return {
      ok: true,
      content: `${header}\n${selected.join("\n")}${footer}`,
      metadata: {
        truncated: nextOffset !== null,
        nextOffset: nextOffset ?? undefined,
        totalLines: total,
        startLine: start + 1,
        endLine: end,
      },
    };
  },
};
