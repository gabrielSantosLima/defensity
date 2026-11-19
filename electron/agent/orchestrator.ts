import path from "node:path";
import type {
  AgentEmit,
  AgentMessage,
  AgentStartPayload,
  Usage,
} from "./types";
import { compactMessages } from "./context";
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
- probe_run sends bounded HTTP requests from the sandbox and load_run runs a
  Gatling scenario. Use them only against the workspace target.
- Record every candidate weakness with hypothesis_record before finishing.
- Each run starts with a clean hypothesis list. Use hypotheses from the workspace
  context as background, but do not repeat one unless you have new evidence.
- After a validator confirms a weakness, record it with finding_record and cite
  the validator and its evidence. Severity: critical when reachable from
  untrusted input with high impact, high when reachable with a precondition,
  medium when configuration or a role is required, low otherwise.
- Issues already listed in the workspace context are registered. Never record
  them again; only record a validated vulnerability that does not exist yet.
- A hypothesis needs evidence from a tool result: a file:line, a request/response
  or a dependency with its version. Never record one from intuition alone.
- Rank honestly: impact and plausibility from 1 to 5.
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
  const task =
    workspace.type === "web"
      ? `Fetch the target root and up to five same-origin paths with web_fetch.
Identify the exposed surface and record evidence-backed hypotheses about
authorization, data exposure, injection and configuration.`
      : workspace.type === "library"
        ? `Call deps_scan to list the resolved dependencies, then record
evidence-backed hypotheses about dependency risk, pinned versions and missing
patch levels.`
        : `Inspect the available files and record evidence-backed hypotheses about
the security-relevant surface you can prove.`;

  return `Workspace: ${workspace.name} (${workspace.type})
Target: ${targetLabel(payload)}
Allowed root: ${root ?? "(none)"}

${task}

Finish with a short summary of what you inspected and how many hypotheses you
recorded.${payload.seed ? `

[workspace context]
${payload.seed}

Use this context to avoid duplicate work. Verify what is still valid before
trusting it, and do not repeat a tool call whose result is already in the context.` : ""}`;
}

const ZERO: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

export async function runAgent(
  payload: AgentStartPayload,
  emit: AgentEmit,
  signal: AbortSignal,
): Promise<{ usage: Usage; steps: number }> {
  const root = pickRoot(payload);
  const toolset = createToolset({
    root,
    targetUrl: payload.workspace.targetUrl,
    libraryArtifactPath: payload.workspace.libraryArtifactPath,
    allowInvalidCertificates: payload.allowInvalidCertificates,
    dockerHost: payload.dockerHost ?? "",
    knownFindingTitles: new Set(payload.knownFindingTitles ?? []),
  });
  const provider = createProvider({
    provider: payload.provider,
    model: payload.model,
    apiKey: payload.apiKey,
    baseUrl: payload.baseUrl,
  });

  let messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildTaskPrompt(payload, root) },
  ];

  const usage: Usage = { ...ZERO };
  let steps = 0;

  // No artificial step cap: the run ends when the model stops calling tools,
  // the token budget is exhausted or the user cancels.
  for (let step = 1; ; step += 1) {
    if (signal.aborted) {
      throw new Error("cancelled");
    }
    steps = step;

    const compaction = compactMessages(messages, payload.limits.budget);
    if (compaction) {
      messages = compaction.messages;
      emit("compaction", {
        tokensBefore: compaction.tokensBefore,
        tokensAfter: compaction.tokensAfter,
        removedMessages: compaction.removed,
      });
    }

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

      if (usage.totalTokens > payload.limits.maxTokens) {
        throw new Error(
          `Token budget exhausted: ${usage.totalTokens} of ${payload.limits.maxTokens}`,
        );
      }
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
        preview: outcome.content.slice(0, 12000),
        chars: outcome.content.length,
      });

      if (call.name === "finding_record" && outcome.ok) {
        emit("finding", {
          title: call.arguments.title,
          severity: call.arguments.severity,
          class: call.arguments.class,
          evidence: call.arguments.evidence,
          validator: call.arguments.validator,
          hypothesisId: call.arguments.hypothesisId ?? null,
        });
      }

      if (call.name === "hypothesis_record" && outcome.ok) {
        emit("hypothesis", {
          statement: call.arguments.statement,
          class: call.arguments.class,
          impact: call.arguments.impact,
          plausibility: call.arguments.plausibility,
          rationale: call.arguments.rationale,
          evidence: call.arguments.evidence,
          proposedTest: call.arguments.proposedTest ?? null,
        });
      }
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content,
      });
    }
  }

  return { usage, steps };
}
