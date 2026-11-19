import type { Finding, Hypothesis, Run, RunEvent } from "../../../shared/types";
import { normalizeFindingTitle } from "../../../shared/findings";

const MAX_CONTEXT_CHARS = 12000;
const MAX_TRANSCRIPT_CHARS = 7000;
const MAX_ITEMS = 20;

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, length: number): string {
  const clean = oneLine(text);
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const unique: Finding[] = [];
  for (const finding of findings) {
    const key = normalizeFindingTitle(finding.title);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(finding);
  }
  return unique;
}

function dedupeHypotheses(hypotheses: Hypothesis[]): Hypothesis[] {
  const seen = new Set<string>();
  const unique: Hypothesis[] = [];
  for (const hypothesis of hypotheses) {
    const key = oneLine(hypothesis.statement).toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(hypothesis);
  }
  return unique;
}

/**
 * Condenses the source run into a compact transcript so a rerun starts with the
 * original conversation in context instead of only a final summary.
 */
export function buildConversationTranscript(events: RunEvent[]): string {
  const lines: string[] = [];
  let total = 0;

  for (const event of events) {
    let line: string | null = null;
    if (event.type === "assistant.message") {
      const text = clip(String(event.payload.text ?? ""), 700);
      if (text) {
        line = `assistant: ${text}`;
      }
    } else if (event.type === "tool.call") {
      line = `tool call ${String(event.payload.name ?? "tool")}: ${clip(
        JSON.stringify(event.payload.arguments ?? {}),
        240,
      )}`;
    } else if (event.type === "tool.result") {
      const ok = event.payload.ok !== false;
      line = `tool result (${ok ? "ok" : "error"}, ${Number(
        event.payload.chars ?? 0,
      )} chars): ${clip(String(event.payload.preview ?? ""), 320)}`;
    } else if (event.type === "hypothesis") {
      line = `hypothesis [${String(event.payload.class ?? "other")}]: ${clip(
        String(event.payload.statement ?? ""),
        300,
      )}`;
    } else if (event.type === "finding") {
      line = `finding [${String(event.payload.severity ?? "low")}]: ${clip(
        String(event.payload.title ?? ""),
        300,
      )}`;
    }

    if (!line) {
      continue;
    }
    if (total + line.length > MAX_TRANSCRIPT_CHARS) {
      lines.push("… (transcript truncated)");
      break;
    }
    lines.push(line);
    total += line.length + 1;
  }

  return lines.join("\n");
}

export interface RunContextInput {
  /** Every issue already registered in the workspace. */
  issues: Finding[];
  /** Hypotheses from earlier runs in the same workspace. */
  hypotheses: Hypothesis[];
  /** Set when the run was started from a previous run. */
  sourceRun?: Run | null;
  sourceEvents?: RunEvent[];
}

/**
 * Builds the workspace knowledge that every run receives. It keeps repeated
 * runs aware of registered issues and previous hypotheses, while each run still
 * starts with an empty hypothesis list of its own.
 */
export function buildRunContext(input: RunContextInput): string | undefined {
  const sections: string[] = [];

  const issues = dedupeFindings(input.issues).slice(0, MAX_ITEMS);
  if (issues.length > 0) {
    sections.push(
      [
        "Existing validated issues in this workspace. They are already registered: do not record them again.",
        ...issues.map(
          (issue) =>
            `- [${issue.severity}/${issue.class}] ${issue.title} (validator: ${issue.validator})\n  evidence: ${clip(issue.evidence, 300)}`,
        ),
      ].join("\n"),
    );
  }

  const hypotheses = dedupeHypotheses(input.hypotheses).slice(0, MAX_ITEMS);
  if (hypotheses.length > 0) {
    sections.push(
      [
        "Hypotheses explored in earlier runs. This run starts with a clean hypothesis list: keep one only if you have new evidence, and validate it before turning it into a finding.",
        ...hypotheses.map(
          (hypothesis) =>
            `- [${hypothesis.class} ${hypothesis.impact * hypothesis.plausibility}/25] ${hypothesis.statement}\n  last evidence: ${clip(hypothesis.evidence, 220)}`,
        ),
      ].join("\n"),
    );
  }

  if (input.sourceRun) {
    const run = input.sourceRun;
    const transcript = buildConversationTranscript(input.sourceEvents ?? []);
    sections.push(
      [
        `Source conversation from run ${run.id} (${run.status}, ${run.stepCount} steps, ${run.totalTokens} tokens). Continue from it; verify what is still valid instead of repeating tool calls.`,
        transcript || "(the source run recorded no conversation events)",
      ].join("\n"),
    );
  }

  const context = sections.join("\n\n");
  if (!context) {
    return undefined;
  }
  return context.length > MAX_CONTEXT_CHARS
    ? `${context.slice(0, MAX_CONTEXT_CHARS)}\n… (workspace context truncated)`
    : context;
}
