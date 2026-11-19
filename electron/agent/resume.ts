import type { RunEvent } from "../../shared/types";
import type { AgentMessage, AgentToolCall } from "./types";

export const CONTINUE_PROMPT = `Continue the same analysis from the current state. Do not restart the run or repeat completed work. Call hypothesis_list to reload the hypotheses and findings recorded so far. Validate the hypotheses that are still open, record only new findings, and then report.`;

function asArguments(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Rebuilds the agent conversation from persisted run events so a continued run
 * keeps the same context. Tool calls and results are paired again in order,
 * and the caller receives a new user turn that resumes the pipeline.
 */
export function buildResumeMessages(events: RunEvent[]): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let currentAssistant: AgentMessage | null = null;
  let pending: AgentToolCall[] = [];
  let seq = 0;

  for (const event of events) {
    if (event.type === "step.started") {
      currentAssistant = null;
      pending = [];
      continue;
    }

    if (event.type === "assistant.message") {
      const text = String(event.payload.text ?? "");
      if (!text.trim()) {
        continue;
      }
      currentAssistant = {
        id: `resume-a-${seq++}`,
        role: "assistant",
        content: text,
        toolCalls: [],
      };
      messages.push(currentAssistant);
      pending = [];
      continue;
    }

    if (event.type === "tool.call") {
      if (!currentAssistant) {
        currentAssistant = {
          id: `resume-a-${seq++}`,
          role: "assistant",
          content: "",
          toolCalls: [],
        };
        messages.push(currentAssistant);
      }
      const call: AgentToolCall = {
        id: `resume-c-${seq++}`,
        name: String(event.payload.name ?? "tool"),
        arguments: asArguments(event.payload.arguments),
      };
      currentAssistant.toolCalls?.push(call);
      pending.push(call);
      continue;
    }

    if (event.type === "tool.result") {
      const call = pending.shift();
      if (!call) {
        continue;
      }
      messages.push({
        id: `resume-t-${seq++}`,
        role: "tool",
        toolCallId: call.id,
        content: String(event.payload.preview ?? ""),
      });
    }
  }

  messages.push({
    id: `resume-u-${seq++}`,
    role: "user",
    content: CONTINUE_PROMPT,
  });
  return messages;
}
