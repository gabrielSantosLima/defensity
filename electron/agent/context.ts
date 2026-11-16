import type { AgentMessage } from "./types";

const KEEP_TAIL = 6;
const TRIGGER_RATIO = 0.8;
const SUMMARY_MAX_CHARS = 4000;

export function estimateTokens(messages: AgentMessage[]): number {
  let chars = 0;
  for (const message of messages) {
    chars += message.content.length;
    for (const call of message.toolCalls ?? []) {
      chars += call.name.length + JSON.stringify(call.arguments).length;
    }
  }
  return Math.ceil(chars / 4);
}

function summarize(messages: AgentMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role === "assistant") {
      const text = message.content.replace(/\s+/g, " ").slice(0, 180);
      const tools = (message.toolCalls ?? []).map((call) => call.name).join(", ");
      if (text || tools) {
        lines.push(`- assistant${tools ? ` [${tools}]` : ""}: ${text}`);
      }
    } else if (message.role === "tool") {
      const text = message.content.replace(/\s+/g, " ").slice(0, 120);
      lines.push(`- tool result: ${text}`);
    }
    if (lines.join("\n").length > SUMMARY_MAX_CHARS) {
      break;
    }
  }
  const summary = lines.join("\n");
  return summary.length > SUMMARY_MAX_CHARS
    ? `${summary.slice(0, SUMMARY_MAX_CHARS)}\n… (summary truncated)`
    : summary;
}

export interface Compaction {
  messages: AgentMessage[];
  tokensBefore: number;
  tokensAfter: number;
  removed: number;
}

/**
 * Deterministic compaction: the system prompt and the task stay, the oldest
 * turns collapse into a short digest, and the tail stays verbatim. It moves the
 * tail boundary so it never starts with an orphan tool result.
 */
export function compactMessages(
  messages: AgentMessage[],
  budget: number,
): Compaction | null {
  const tokensBefore = estimateTokens(messages);
  if (tokensBefore <= budget * TRIGGER_RATIO) {
    return null;
  }
  if (messages.length <= KEEP_TAIL + 2) {
    return null;
  }

  const system = messages[0];
  const task = messages[1];
  let start = messages.length - KEEP_TAIL;
  // Move forward to a valid boundary so the tail never starts with an orphan
  // tool result. This can retain fewer than KEEP_TAIL messages, which is fine.
  while (start < messages.length && messages[start].role === "tool") {
    start += 1;
  }
  if (start < 3 || start >= messages.length) {
    return null;
  }

  const old = messages.slice(2, start);
  if (old.length === 0) {
    return null;
  }

  const digest = summarize(old);
  const merged: AgentMessage = {
    role: "user",
    content: `${task.content}\n\n[compacted session context]\n${digest}`,
  };
  const next: AgentMessage[] = [system, merged, ...messages.slice(start)];

  return {
    messages: next,
    tokensBefore,
    tokensAfter: estimateTokens(next),
    removed: old.length,
  };
}
