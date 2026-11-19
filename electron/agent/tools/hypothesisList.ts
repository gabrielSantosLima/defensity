import type { Tool, ToolResult } from "./types";

function clip(text: string, length: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

/**
 * Reads the hypotheses and findings recorded so far. This survives context
 * compaction because the list lives outside the message history.
 */
export const hypothesisListTool: Tool = {
  definition: {
    name: "hypothesis_list",
    description:
      "Return the hypotheses and validated findings recorded in this workspace and run. Call it after a context compaction, or before recording, to recover the current analysis state and avoid duplicates.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  async execute(_args, context): Promise<ToolResult> {
    const lines: string[] = [
      `Hypotheses recorded (${context.hypotheses.length}):`,
    ];
    if (context.hypotheses.length === 0) {
      lines.push("- (none)");
    } else {
      for (const hypothesis of context.hypotheses) {
        lines.push(
          `- [${hypothesis.class} ${hypothesis.impact * hypothesis.plausibility}/25] ${hypothesis.statement}`,
          `  evidence: ${clip(hypothesis.evidence, 240)}`,
        );
        if (hypothesis.proposedTest) {
          lines.push(`  proposed test: ${clip(hypothesis.proposedTest, 180)}`);
        }
      }
    }

    lines.push("", `Validated findings (${context.findings.length}):`);
    if (context.findings.length === 0) {
      lines.push("- (none)");
    } else {
      for (const finding of context.findings) {
        lines.push(
          `- [${finding.severity}/${finding.class}] ${finding.title} (validator: ${finding.validator})`,
          `  evidence: ${clip(finding.evidence, 240)}`,
        );
      }
    }

    lines.push(
      "",
      "Do not record a hypothesis or finding that already appears above.",
    );
    return { ok: true, content: lines.join("\n") };
  },
};
