import { stringArg } from "./args";
import type { Tool, ToolResult } from "./types";

const CLASSES = new Set([
  "authz",
  "injection",
  "dos",
  "dependency",
  "secrets",
  "config",
  "other",
]);

function rating(args: Record<string, unknown>, key: string): number | null {
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }
  return value;
}

export const hypothesisRecordTool: Tool = {
  definition: {
    name: "hypothesis_record",
    description:
      "Record one evidence-backed hypothesis. Use it for every candidate weakness you want in the report.",
    parameters: {
      type: "object",
      properties: {
        statement: {
          type: "string",
          description: "The testable claim, one sentence",
        },
        class: {
          type: "string",
          enum: ["authz", "injection", "dos", "dependency", "secrets", "config", "other"],
        },
        impact: { type: "integer", minimum: 1, maximum: 5 },
        plausibility: { type: "integer", minimum: 1, maximum: 5 },
        rationale: { type: "string", description: "Why this could be true" },
        evidence: {
          type: "string",
          description: "Exact file:line, request or dependency reference",
        },
        proposedTest: {
          type: "string",
          description: "How validation would confirm it",
        },
      },
      required: [
        "statement",
        "class",
        "impact",
        "plausibility",
        "rationale",
        "evidence",
      ],
      additionalProperties: false,
    },
  },

  async execute(args): Promise<ToolResult> {
    const statement = stringArg(args, "statement")?.trim();
    const kind = stringArg(args, "class")?.trim();
    const rationale = stringArg(args, "rationale")?.trim();
    const evidence = stringArg(args, "evidence")?.trim();
    const impact = rating(args, "impact");
    const plausibility = rating(args, "plausibility");

    if (!statement) {
      return { ok: false, content: "Missing argument: statement" };
    }
    if (!kind || !CLASSES.has(kind)) {
      return {
        ok: false,
        content: `Invalid class. Use one of: ${[...CLASSES].join(", ")}`,
      };
    }
    if (impact === null || plausibility === null) {
      return {
        ok: false,
        content: "impact and plausibility must be integers from 1 to 5",
      };
    }
    if (!rationale || !evidence) {
      return {
        ok: false,
        content: "rationale and evidence are required",
      };
    }

    return {
      ok: true,
      content: `Hypothesis recorded: ${statement} (${kind}, ${impact * plausibility}/25)`,
    };
  },
};
