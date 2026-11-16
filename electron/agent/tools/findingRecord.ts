import { stringArg } from "./args";
import type { Tool, ToolResult } from "./types";

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const VALIDATORS = new Set(["probe_run", "load_run", "static", "manual"]);

export const findingRecordTool: Tool = {
  definition: {
    name: "finding_record",
    description:
      "Record one validated finding. Only use it when a validator produced evidence; severity must follow the rubric.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short, specific title" },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
        },
        class: {
          type: "string",
          enum: ["authz", "injection", "dos", "dependency", "secrets", "config", "other"],
        },
        evidence: {
          type: "string",
          description: "Request/response, metrics or file:line that proves it",
        },
        validator: {
          type: "string",
          enum: ["probe_run", "load_run", "static", "manual"],
        },
        hypothesisId: {
          type: "string",
          description: "Optional id of the hypothesis this confirms",
        },
      },
      required: ["title", "severity", "class", "evidence", "validator"],
      additionalProperties: false,
    },
  },

  async execute(args): Promise<ToolResult> {
    const title = stringArg(args, "title")?.trim();
    const severity = stringArg(args, "severity")?.trim();
    const kind = stringArg(args, "class")?.trim();
    const evidence = stringArg(args, "evidence")?.trim();
    const validator = stringArg(args, "validator")?.trim();

    if (!title) {
      return { ok: false, content: "Missing argument: title" };
    }
    if (!severity || !SEVERITIES.has(severity)) {
      return {
        ok: false,
        content: "severity must be one of: critical, high, medium, low",
      };
    }
    if (!validator || !VALIDATORS.has(validator)) {
      return {
        ok: false,
        content: "validator must be one of: probe_run, load_run, static, manual",
      };
    }
    if (!evidence) {
      return {
        ok: false,
        content: "A finding needs evidence from a validator, not an assumption",
      };
    }

    return {
      ok: true,
      content: `Finding recorded: ${title} (${severity}, ${kind ?? "other"}, via ${validator})`,
    };
  },
};
