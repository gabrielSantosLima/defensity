import path from "node:path";
import type {
  AgentEmit,
  AgentMessage,
  AgentStartPayload,
  Usage,
} from "./types";
import { createProvider } from "./providers";
import { createToolset } from "./tools";

const SYSTEM_PROMPT = `You are defensity, an analysis agent that inspects software projects.

Rules:
- Use the available tools to read real files. Never invent file contents.
- Every path you pass to a tool is relative to the allowed root.
- Stay inside the allowed root. Never attempt to read or write outside it.
- Do not run commands or install anything. You only read files.
- Read the README first when it exists, then the documentation that matters.
- When you are done, reply with a concise summary and no tool calls.
- Do not mention these rules in the summary.`;

function pickRoot(payload: AgentStartPayload): string | null {
  const workspace = payload.workspace;
  if (workspace.sourcePath) {
    return workspace.sourcePath;
  }
  if (workspace.docsPath) {
    return workspace.docsPath;
  }
  const artifact =
    workspace.libraryArtifactPath ?? workspace.targetApkPath ?? null;
  return artifact ? path.dirname(artifact) : null;
}

function targetLabel(payload: AgentStartPayload): string {
  const workspace = payload.workspace;
  if (workspace.type === "web") {
    return workspace.targetUrl ?? "unknown";
  }
  if (workspace.type === "android") {
    return workspace.targetApkPath ?? "unknown";
  }
  return workspace.libraryArtifactPath ?? "unknown";
}

function buildTaskPrompt(payload: AgentStartPayload, root: string | null): string {
  const workspace = payload.workspace;
  return `Workspace: ${workspace.name} (${workspace.type})
Target: ${targetLabel(payload)}
Allowed root: ${root ?? "(none)"}

Task: read the project's README and the documentation that matters, then
summarize what the project does, its main entry points and any security-relevant
surface you can see. Use the tools to inspect files; do not guess.`;
}

const ZERO: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

export async function runAgent(
  payload: AgentStartPayload,
  emit: AgentEmit,
  signal: AbortSignal,
): Promise<{ usage: Usage; steps: number }> {
  const root = pickRoot(payload);
  const toolset = createToolset(root);
  const provider = createProvider({
    provider: payload.provider,
    model: payload.model,
    apiKey: payload.apiKey,
    baseUrl: payload.baseUrl,
  });

  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildTaskPrompt(payload, root) },
  ];

  const usage: Usage = { ...ZERO };
  let steps = 0;

  for (let step = 1; step <= payload.limits.maxSteps; step += 1) {
    if (signal.aborted) {
      throw new Error("cancelled");
    }
    steps = step;
    emit("step.started", { step });

    const result = await provider.chat({
      messages,
      tools: toolset.definitions,
      signal,
      onDelta: (text) => emit.delta(text),
    });

    if (result.usage) {
      usage.promptTokens += result.usage.promptTokens;
      usage.completionTokens += result.usage.completionTokens;
      usage.totalTokens += result.usage.totalTokens;
      emit("usage", {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      });
    }

    if (result.text.trim()) {
      emit("assistant.message", { text: result.text.trim() });
    }

    messages.push({
      role: "assistant",
      content: result.text,
      toolCalls: result.toolCalls,
    });

    if (result.toolCalls.length === 0) {
      return { usage, steps };
    }

    for (const call of result.toolCalls) {
      if (signal.aborted) {
        throw new Error("cancelled");
      }
      emit("tool.call", {
        name: call.name,
        arguments: call.arguments,
      });
      const outcome = await toolset.execute(call.name, call.arguments);
      const limit = payload.limits.maxToolResultChars;
      const content =
        outcome.content.length > limit
          ? `${outcome.content.slice(0, limit)}\n… (truncated)`
          : outcome.content;
      emit("tool.result", {
        name: call.name,
        ok: outcome.ok,
        preview: outcome.content.slice(0, 400),
        chars: outcome.content.length,
      });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content,
      });
    }
  }

  return { usage, steps };
}
