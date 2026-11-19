import type {
  AgentFinding,
  AgentHypothesis,
  AgentMessage,
  ChatProvider,
  Usage,
} from "./types";

const CHARS_PER_TOKEN = 4;
const RESERVE_SHARE = 0.15;
const RESERVE_MIN = 16_000;
/** Working context budget for large model windows, to keep repeated steps affordable. */
const WORKING_CONTEXT_CAP = 64_000;
const TAIL_MAX = 15_000;
const TAIL_MIN = 2_000;
const PRECOMPUTE_LEAD_MAX = 60_000;
const PRECOMPUTE_LEAD_MIN = 8_000;
const TRANSCRIPT_CLIP = 2_000;
const SUMMARY_MAX_CHARS = 12_000;
const OMITTED = 4;

const SUMMARY_SYSTEM = `You are defensity's context compactor. Summarize the conversation so another agent can resume the security analysis exactly where it stopped. Do not continue the task, call tools, or invent facts. Preserve evidence, hypotheses, findings and open work.`;

const SUMMARY_TEMPLATE = `Use this format and keep every section (write "(none)" when empty):
## Objective
- [what the analysis is trying to prove]

## Scope and Target
- [workspace type, target, allowed root and authorization limits]

## Requirements
- [constraints and explicit user requirements]

## Decisions
- [decisions already made and why]

## Work State
### Completed
- [finished work]
### Active
- [work in progress]
### Blocked
- [blockers]
### Next Move
1. [ordered next actions]

## Hypotheses
- [class impact/plausibility] statement
  evidence: exact file:line, request/response or dependency reference
  status: open, confirmed or refuted

## Findings
- [severity] title (validator)
  evidence: the proof that survived validation

## Relevant Files
- \`path\`: why another agent needs it (at most 15)

## Important Context
- [facts that cannot be recovered from the files]`;

const SUMMARY_RULES = `Rules:
- Be terse. Use single-line bullets, not prose.
- Preserve exact paths, symbols, commands, URLs, identifiers, error strings and evidence.
- Carry forward every hypothesis and finding that is still relevant.
- Preserve whether changes are uncommitted, committed, pushed or still under review.
- Newer history wins over the existing checkpoint when they disagree.
- Do not mention the compaction process.`;

export interface MeasuredAnchor {
  count: number;
  tokens: number;
}

export interface SummaryResult {
  summary: string;
  usage: Usage | null;
  fallback: boolean;
  error: string | null;
}

export function estimateText(text: string): number {
  return Math.max(0, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function estimateMessage(message: AgentMessage): number {
  let chars = message.content.length;
  for (const call of message.toolCalls ?? []) {
    chars += call.name.length + JSON.stringify(call.arguments).length;
  }
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

export function estimateMessages(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => total + estimateMessage(message), 0);
}

export function estimatePrompt(
  messages: AgentMessage[],
  anchor: MeasuredAnchor | null,
): number {
  if (anchor && anchor.count > 0 && anchor.count <= messages.length) {
    return anchor.tokens + estimateMessages(messages.slice(anchor.count));
  }
  return estimateMessages(messages);
}

function parseWindowFromModel(model: string): number | null {
  const match = model.match(/(\d+(?:\.\d+)?)\s*([km])(?![a-z])/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * (match[2].toLowerCase() === "m" ? 1_000_000 : 1_000));
}

/**
 * Defensity has no model catalog, so the window comes from an explicit size in
 * the model id when present, otherwise from a conservative provider default.
 * Overflow recovery handles a window that turns out to be smaller.
 */
export function resolveContextWindow(provider: string, model: string): number {
  const declared = parseWindowFromModel(model);
  if (declared) {
    return declared;
  }
  if (provider === "gemini") {
    return 1_000_000;
  }
  if (provider === "anthropic") {
    return 200_000;
  }
  return 128_000;
}

export function compactionCeiling(window: number): number {
  const reserve =
    window >= 2 * RESERVE_MIN
      ? Math.max(Math.floor(window * RESERVE_SHARE), RESERVE_MIN)
      : Math.floor(window * RESERVE_SHARE);
  return Math.max(4_000, Math.min(window - reserve, WORKING_CONTEXT_CAP));
}

export function tailTokenLimit(window: number, ceiling: number): number {
  return Math.min(
    TAIL_MAX,
    Math.max(TAIL_MIN, Math.floor(ceiling * 0.12)),
  );
}

export function precomputeLead(window: number): number {
  return Math.min(
    PRECOMPUTE_LEAD_MAX,
    Math.max(PRECOMPUTE_LEAD_MIN, Math.floor(window * 0.15)),
  );
}

function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

export function isContextOverflowError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 413) {
    return true;
  }
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("context length") ||
    message.includes("context window") ||
    message.includes("maximum context") ||
    message.includes("context_length_exceeded") ||
    message.includes("prompt is too long") ||
    message.includes("input is too long") ||
    message.includes("too many tokens") ||
    message.includes("maximum number of tokens") ||
    message.includes("token limit") ||
    message.includes("reduce the length") ||
    message.includes("payload too large") ||
    message.includes("request entity too large")
  );
}

export function findTailStart(messages: AgentMessage[], keep: number): number {
  if (messages.length === 0) {
    return 0;
  }
  let total = 0;
  let start = messages.length;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const size = estimateMessage(messages[index]);
    if (start < messages.length && total + size > keep) {
      break;
    }
    total += size;
    start = index;
  }
  // Keep whole exchanges together. Our conversation is mostly assistant and
  // tool messages, so an assistant boundary is valid; a tool result must move
  // back to the assistant that issued it.
  while (start > 0 && messages[start].role === "tool") {
    start -= 1;
  }
  return start;
}

export interface ConversationSplit {
  previousSummary: string | null;
  history: AgentMessage[];
  tail: AgentMessage[];
  tailStartId: string | null;
}

export function splitConversation(
  conversation: AgentMessage[],
  keep: number,
): ConversationSplit {
  const checkpoint = conversation.find(
    (message) => message.kind === "checkpoint",
  );
  const historyMessages = conversation.filter(
    (message) => message.kind !== "checkpoint",
  );
  const tailStart = findTailStart(historyMessages, keep);
  const tail = historyMessages.slice(tailStart);
  const total = estimateMessages(historyMessages);
  // A single exchange larger than the tail budget cannot keep a verbatim
  // tail. Summarize the whole exchange rather than refusing to compact.
  if (tailStart === 0 && total > keep) {
    return {
      previousSummary: checkpoint?.checkpoint ?? null,
      history: historyMessages,
      tail: [],
      tailStartId: null,
    };
  }
  return {
    previousSummary: checkpoint?.checkpoint ?? null,
    history: historyMessages.slice(0, tailStart),
    tail,
    tailStartId: tail[0]?.id ?? null,
  };
}

function clipText(value: string): string {
  if (value.length <= TRANSCRIPT_CLIP) {
    return value;
  }
  const chars = Array.from(value);
  if (chars.length <= TRANSCRIPT_CLIP) {
    return value;
  }
  const half = Math.floor(TRANSCRIPT_CLIP / 2);
  const omitted = chars.length - TRANSCRIPT_CLIP;
  return `${chars.slice(0, half).join("")}\n[… ${omitted} characters omitted …]\n${chars.slice(-half).join("")}`;
}

function renderMessage(message: AgentMessage, level: number): string {
  if (message.role === "system" || level >= OMITTED) {
    return "";
  }
  if (level >= 3 && message.role !== "user") {
    return "";
  }
  if (message.role === "user") {
    const text = level >= 3 ? clipText(message.content) : message.content;
    return text ? `[User]: ${text}` : "";
  }
  if (message.role === "assistant") {
    const parts: string[] = [];
    if (message.content.trim()) {
      parts.push(`[Assistant]: ${message.content}`);
    }
    for (const call of message.toolCalls ?? []) {
      const input = JSON.stringify(call.arguments) ?? "";
      parts.push(
        `[Assistant tool call]: ${call.name}(${
          level >= 2 ? clipText(input) : input
        })`,
      );
    }
    return parts.join("\n");
  }
  if (level >= 2) {
    return "[Tool result omitted]";
  }
  const text = level >= 1 ? clipText(message.content) : message.content;
  return text ? `[Tool result]: ${text}` : "";
}

const TRANSCRIPT_LEVELS = [0, 1, 2, 3, OMITTED];

/**
 * Flattens the old history into text for the summary model. Detail is removed
 * from the oldest exchange first, and the newest exchange is never omitted.
 */
export function buildSummaryTranscript(
  history: AgentMessage[],
  targetTokens: number,
): string | null {
  const groups: AgentMessage[][] = [];
  for (const message of history) {
    if (message.role === "user" || groups.length === 0) {
      groups.push([message]);
    } else {
      groups[groups.length - 1].push(message);
    }
  }
  const exchanges = groups
    .map((group) =>
      TRANSCRIPT_LEVELS.map((level) =>
        group
          .map((message) => renderMessage(message, level))
          .filter(Boolean)
          .join("\n"),
      ),
    )
    .filter((renders) => renders[0]);
  if (exchanges.length === 0) {
    return null;
  }

  const size = (text: string) => (text ? estimateText(text) + 1 : 0);
  const note = (omitted: number) =>
    omitted
      ? `[${omitted} older ${omitted === 1 ? "exchange" : "exchanges"} omitted]\n\n`
      : "";
  const room = targetTokens - estimateText(note(exchanges.length));
  const levels = exchanges.map(() => 0);
  let total = exchanges.reduce((sum, renders) => sum + size(renders[0]), 0);
  const newest = exchanges.length - 1;

  for (const level of TRANSCRIPT_LEVELS.slice(1)) {
    for (let index = 0; index < exchanges.length && total > room; index += 1) {
      if (index === newest && !exchanges[index][level]) {
        continue;
      }
      total += size(exchanges[index][level]) - size(exchanges[index][levels[index]]);
      levels[index] = level;
    }
  }

  const omitted = levels.filter(
    (level, index) => !exchanges[index][level],
  ).length;
  const text = exchanges
    .map((renders, index) => renders[levels[index]])
    .filter(Boolean)
    .join("\n\n");
  if (!text) {
    return null;
  }
  return total > Math.max(room, 1)
    ? `${note(omitted)}${clipText(text)}`
    : `${note(omitted)}${text}`;
}

export function buildSummaryUserPrompt(
  transcript: string,
  previousSummary: string | null,
  scope?: string,
): string {
  const parts = [
    SUMMARY_TEMPLATE,
    SUMMARY_RULES,
    "Return only the structured summary. Do not include a preamble or commentary.",
  ];
  if (scope) {
    parts.unshift(`Session task and scope:\n<scope>\n${scope}\n</scope>`);
  }
  if (previousSummary) {
    parts.unshift(
      `Existing checkpoint to update. Preserve what is still valid and incorporate the newer history:\n<checkpoint>\n${previousSummary}\n</checkpoint>`,
    );
  }
  parts.push(`Conversation to summarize:\n\n${transcript}`);
  return parts.join("\n\n");
}

export function fallbackSummary(
  history: AgentMessage[],
  previousSummary: string | null,
): string {
  const lines: string[] = [];
  if (previousSummary) {
    lines.push(previousSummary);
  }
  lines.push("## Important Context");
  for (const message of history) {
    if (message.role === "assistant") {
      const text = message.content.replace(/\s+/g, " ").trim().slice(0, 240);
      const tools = (message.toolCalls ?? []).map((call) => call.name).join(", ");
      if (text || tools) {
        lines.push(`- assistant${tools ? ` [${tools}]` : ""}: ${text}`);
      }
    } else if (message.role === "tool") {
      const text = message.content.replace(/\s+/g, " ").trim().slice(0, 180);
      if (text) {
        lines.push(`- tool result: ${text}`);
      }
    }
    if (lines.join("\n").length > SUMMARY_MAX_CHARS) {
      break;
    }
  }
  const text = lines.join("\n");
  return text.length > SUMMARY_MAX_CHARS
    ? `${text.slice(0, SUMMARY_MAX_CHARS)}\n… (summary truncated)`
    : text;
}

export function createCheckpointMessage(
  summary: string,
  mode: string,
): AgentMessage {
  return {
    id: "checkpoint",
    role: "user",
    kind: "checkpoint",
    checkpoint: summary,
    content: `[context checkpoint]\n${summary}\n[end checkpoint]\n\nThe earlier conversation was compacted (${mode}) to fit the model window. Continue from this checkpoint. Call hypothesis_list to recover the hypotheses and findings recorded so far before recording new ones.`,
  };
}

export async function generateSummary(input: {
  provider: ChatProvider;
  history: AgentMessage[];
  previousSummary: string | null;
  scope?: string;
  targetTokens: number;
  signal: AbortSignal;
  onUsage?: (usage: Usage) => void;
}): Promise<SummaryResult> {
  const transcript = buildSummaryTranscript(input.history, input.targetTokens);
  if (!transcript) {
    return {
      summary: fallbackSummary(input.history, input.previousSummary),
      usage: null,
      fallback: true,
      error: null,
    };
  }

  const attempt = async (targetTokens: number): Promise<SummaryResult> => {
    const response = await input.provider.chat({
      messages: [
        { role: "system", content: SUMMARY_SYSTEM },
        {
          role: "user",
          content: buildSummaryUserPrompt(
            buildSummaryTranscript(input.history, targetTokens) ?? transcript,
            input.previousSummary,
            input.scope,
          ),
        },
      ],
      tools: [],
      signal: input.signal,
    });
    if (response.usage) {
      input.onUsage?.(response.usage);
    }
    const summary = response.text.trim().slice(0, SUMMARY_MAX_CHARS);
    if (!summary) {
      return {
        summary: fallbackSummary(input.history, input.previousSummary),
        usage: response.usage,
        fallback: true,
        error: "The model returned an empty summary",
      };
    }
    return { summary, usage: response.usage, fallback: false, error: null };
  };

  try {
    return await attempt(input.targetTokens);
  } catch (error) {
    if (isContextOverflowError(error) && input.targetTokens > 4_000) {
      try {
        return await attempt(Math.max(4_000, Math.floor(input.targetTokens / 2)));
      } catch (retry) {
        error = retry;
      }
    }
    return {
      summary: fallbackSummary(input.history, input.previousSummary),
      usage: null,
      fallback: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function addHypothesis(
  list: AgentHypothesis[],
  hypothesis: AgentHypothesis,
): void {
  const key = hypothesis.statement.replace(/\s+/g, " ").trim().toLowerCase();
  if (!key || list.some((entry) => entry.statement.replace(/\s+/g, " ").trim().toLowerCase() === key)) {
    return;
  }
  list.push(hypothesis);
}

export function addFinding(list: AgentFinding[], finding: AgentFinding): void {
  const key = finding.title.replace(/\s+/g, " ").trim().toLowerCase();
  if (!key || list.some((entry) => entry.title.replace(/\s+/g, " ").trim().toLowerCase() === key)) {
    return;
  }
  list.push(finding);
}
