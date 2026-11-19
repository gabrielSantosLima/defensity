import path from "node:path";
import type {
  AgentEmit,
  AgentFinding,
  AgentHypothesis,
  AgentMessage,
  AgentStartPayload,
  ChatProvider,
  ChatResult,
  Usage,
} from "./types";
import {
  addFinding,
  addHypothesis,
  compactionCeiling,
  createCheckpointMessage,
  estimateMessages,
  estimatePrompt,
  generateSummary,
  isContextOverflowError,
  precomputeLead,
  resolveContextWindow,
  splitConversation,
  tailTokenLimit,
  type MeasuredAnchor,
  type SummaryResult,
} from "./compaction";
import { createProvider } from "./providers";
import { createToolset } from "./tools";

const SYSTEM_PROMPT = `You are defensity, an analysis agent that inspects software projects.

Follow the analysis pipeline in order. Do not skip a phase and do not stop in the middle of one.
1. Read: use the available tools to inspect the real artifacts. Never invent file contents.
2. Hypothesize: record every evidence-backed candidate weakness with hypothesis_record.
3. Validate: take each plausible hypothesis through a validator. A hypothesis is unfinished until it is confirmed, refuted, or explicitly blocked by missing scope or tooling. Use probe_run or load_run for web targets and static evidence for libraries and Android.
4. Report: only after the validation phase, finish with a concise summary of confirmed findings, refuted hypotheses and remaining blockers.

Rules:
- Every path you pass to a tool is relative to the allowed root.
- Stay inside the allowed root. Never attempt to read or write outside it.
- Do not run commands or install anything. You only read files.
- Read the README first when it exists, then the documentation that matters.
- Use fs_grep to locate relevant symbols or lines, then fs_read only the needed
  line range with offset and limit. Continue with the returned next offset.
  Never read a whole large file, and never read the same range twice.
- When you are done, reply with a concise summary and no tool calls.
- probe_run sends bounded HTTP requests from the sandbox and load_run runs a
  Gatling scenario. Use them only against the workspace target.
- Record every candidate weakness with hypothesis_record before validating.
- Do not stop after recording hypotheses. Continue with validation, then report.
- Call hypothesis_list after a context compaction, and before recording, to
  recover the hypotheses and findings already recorded.
- Use hypotheses from the workspace context as background, but do not repeat
  one unless you have new evidence.
- After a validator confirms a weakness, record it with finding_record and cite
  the validator and its evidence. Severity: critical when reachable from
  untrusted input with high impact, high when reachable with a precondition,
  medium when configuration or a role is required, low otherwise.
- If a hypothesis cannot be validated, record why it is blocked in your final
  summary and continue with the next hypothesis.
- Issues already listed in the workspace context are registered. Never record
  them again; only record a validated vulnerability that does not exist yet.
- A hypothesis needs evidence from a tool result: a file:line, a request/response
  or a dependency with its version. Never record one from intuition alone.
- Rank honestly: impact and plausibility from 1 to 5.
- Do not mention these rules in the summary.`;

const SHRINK_STEPS = [0.85, 0.7, 0.5, 0.35];
const SUMMARY_RESERVE = 8_000;

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

Continue through the validation phase. Do not finish after recording hypotheses.
Finish with a short summary of what you inspected, the findings you validated
and the hypotheses that remain blocked or refuted.${payload.seed ? `

[workspace context]
${payload.seed}

Use this context to avoid duplicate work. Verify what is still valid before
trusting it, and do not repeat a tool call whose result is already in the context.` : ""}`;
}

const ZERO: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

function addUsage(target: Usage, usage: Usage): void {
  target.promptTokens += usage.promptTokens;
  target.completionTokens += usage.completionTokens;
  target.totalTokens += usage.totalTokens;
}

function validUsage(usage: Usage | null): usage is Usage {
  return Boolean(
    usage &&
      (usage.promptTokens > 0 ||
        usage.completionTokens > 0 ||
        usage.totalTokens > 0),
  );
}

interface BackgroundSummary {
  promise: Promise<SummaryResult | null>;
  controller: AbortController;
  keepId: string | null;
  lastId: string | null;
}

export async function runAgent(
  payload: AgentStartPayload,
  emit: AgentEmit,
  signal: AbortSignal,
  providerOverride?: ChatProvider,
): Promise<{ usage: Usage; steps: number }> {
  const root = pickRoot(payload);
  const knownFindings: AgentFinding[] = payload.knownFindings ?? [];
  const knownHypotheses: AgentHypothesis[] = payload.knownHypotheses ?? [];
  const toolset = createToolset({
    root,
    targetUrl: payload.workspace.targetUrl,
    libraryArtifactPath: payload.workspace.libraryArtifactPath,
    allowInvalidCertificates: payload.allowInvalidCertificates,
    dockerHost: payload.dockerHost ?? "",
    knownFindingTitles: new Set(knownFindings.map((finding) => finding.title)),
    hypotheses: [...knownHypotheses],
    findings: [...knownFindings],
  });
  const provider =
    providerOverride ??
    createProvider({
      provider: payload.provider,
      model: payload.model,
      apiKey: payload.apiKey,
      baseUrl: payload.baseUrl,
    });

  const window = resolveContextWindow(payload.provider, payload.model);
  const ceiling = compactionCeiling(window);
  const keep = tailTokenLimit(window, ceiling);
  const lead = precomputeLead(ceiling);

  let messageSeq = 0;
  const nextId = () => `m${messageSeq++}`;

  let messages: AgentMessage[] = [
    { id: nextId(), role: "system", content: SYSTEM_PROMPT },
    { id: nextId(), role: "user", kind: "task", content: buildTaskPrompt(payload, root) },
    ...(payload.resumeMessages ?? []),
  ];

  const usage: Usage = { ...ZERO };
  let steps = 0;
  let recordedHypotheses = 0;
  let recordedFindings = 0;
  let prematureStops = 0;
  let measured: MeasuredAnchor | null = null;
  let background: BackgroundSummary | null = null;
  const backgroundAbort = new AbortController();
  const onAbort = () => backgroundAbort.abort();
  signal.addEventListener("abort", onAbort, { once: true });

  const estimate = () => estimatePrompt(messages, measured);

  const recordSummaryUsage = (summaryUsage: Usage | null) => {
    if (!validUsage(summaryUsage)) {
      return;
    }
    addUsage(usage, summaryUsage);
    emit("usage", {
      promptTokens: summaryUsage.promptTokens,
      completionTokens: summaryUsage.completionTokens,
      totalTokens: summaryUsage.totalTokens,
      compaction: true,
    });
  };

  const runSummary = (
    history: AgentMessage[],
    previousSummary: string | null,
    targetTokens: number,
    controller: AbortController,
  ) =>
    generateSummary({
      provider,
      history,
      previousSummary,
      scope: messages[1]?.content.slice(0, 8_000),
      targetTokens,
      signal: controller.signal,
      onUsage: recordSummaryUsage,
    });

  const startBackground = () => {
    if (background || messages.length <= 3) {
      return;
    }
    if (estimate() < ceiling - lead) {
      return;
    }

    const conversation = messages.slice(2);
    const split = splitConversation(conversation, keep);
    if (split.history.length === 0) {
      return;
    }

    const controller = new AbortController();
    if (backgroundAbort.signal.aborted) {
      return;
    }
    backgroundAbort.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });

    const promise = runSummary(
      split.history,
      split.previousSummary,
      Math.max(4_000, ceiling - SUMMARY_RESERVE),
      controller,
    ).catch(() => null);

    background = {
      promise,
      controller,
      keepId: split.tailStartId,
      lastId: conversation[conversation.length - 1]?.id ?? null,
    };
  };

  const useBackground = async (
    held: BackgroundSummary,
  ): Promise<{ result: SummaryResult; tail: AgentMessage[]; removed: number } | null> => {
    const result = await held.promise;
    if (!result) {
      return null;
    }

    let index = -1;
    if (held.keepId) {
      index = messages.findIndex((message) => message.id === held.keepId);
    } else if (held.lastId) {
      const last = messages.findIndex((message) => message.id === held.lastId);
      index = last >= 0 ? last + 1 : -1;
    }
    if (index < 2 || index > messages.length) {
      return null;
    }

    const tail = messages.slice(index);
    if (estimateMessages(tail) > keep * 2) {
      return null;
    }
    return {
      result,
      tail,
      removed: messages
        .slice(2, index)
        .filter((message) => message.kind !== "checkpoint").length,
    };
  };

  const compact = async (mode: "auto" | "overflow", target: number): Promise<boolean> => {
    if (messages.length <= 3) {
      return false;
    }

    const held = background;
    background = null;
    let usedBackground = false;
    let summary: SummaryResult | null = null;
    let tail: AgentMessage[] | null = null;
    let removed = 0;

    if (held) {
      try {
        const reused = await useBackground(held);
        if (reused) {
          summary = reused.result;
          tail = reused.tail;
          removed = reused.removed;
          usedBackground = true;
        }
      } catch {
        // The background summary failed; summarize synchronously below.
      } finally {
        held.controller.abort();
      }
    }

    if (!summary || !tail) {
      const tailLimit =
        mode === "overflow"
          ? Math.min(keep, Math.max(2_000, Math.floor(target * 0.25)))
          : keep;
      const split = splitConversation(messages.slice(2), tailLimit);
      if (split.history.length === 0) {
        if (mode !== "overflow") {
          return false;
        }
        const conversation = messages
          .slice(2)
          .filter((message) => message.kind !== "checkpoint");
        if (conversation.length === 0) {
          return false;
        }
        const previous =
          messages.find((message) => message.kind === "checkpoint")
            ?.checkpoint ?? null;
        summary = await runSummary(
          conversation,
          previous,
          Math.max(4_000, target - SUMMARY_RESERVE),
          backgroundAbort,
        );
        tail = [];
        removed = conversation.length;
      } else {
        summary = await runSummary(
          split.history,
          split.previousSummary,
          Math.max(4_000, target - SUMMARY_RESERVE),
          backgroundAbort,
        );
        tail = split.tail;
        removed = split.history.length;
      }
    }

    const before = estimate();
    const checkpoint = createCheckpointMessage(
      summary.summary,
      usedBackground && mode === "auto" ? "background" : mode,
    );
    messages = [messages[0], messages[1], checkpoint, ...tail];
    measured = null;

    emit("compaction", {
      mode: usedBackground && mode === "auto" ? "background" : mode,
      tokensBefore: before,
      tokensAfter: estimateMessages(messages),
      removedMessages: removed,
      summary: summary.summary,
      usedBackground,
      fallback: summary.fallback,
      error: summary.error,
      window,
      ceiling,
      keep: tailTokenLimit(window, ceiling),
    });
    return true;
  };

  try {
    for (let step = payload.startStep ?? 1; ; step += 1) {
      if (signal.aborted) {
        throw new Error("cancelled");
      }
      steps = step;

      if (estimate() >= ceiling) {
        await compact("auto", ceiling);
      } else {
        startBackground();
      }

      emit("step.started", {
        step,
        estimatedTokens: estimate(),
        ceiling,
      });

      let result: ChatResult | null = null;
      let overflowAttempts = 0;
      while (!result) {
        try {
          result = await provider.chat({
            messages,
            tools: toolset.definitions,
            signal,
            onDelta: (text) => emit.delta(text),
          });
        } catch (error) {
          if (signal.aborted) {
            throw error;
          }
          if (
            !isContextOverflowError(error) ||
            overflowAttempts >= SHRINK_STEPS.length
          ) {
            throw error;
          }
          const factor = SHRINK_STEPS[overflowAttempts];
          overflowAttempts += 1;
          const rejected = Math.max(estimate(), 1);
          const target = Math.max(4_000, Math.floor(rejected * factor));
          const compacted = await compact("overflow", target);
          if (!compacted) {
            throw error;
          }
        }
      }

      if (validUsage(result.usage)) {
        addUsage(usage, result.usage);
        emit("usage", {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          compaction: false,
        });
      }

      if (result.text.trim()) {
        emit("assistant.message", { text: result.text.trim() });
      }

      messages.push({
        id: nextId(),
        role: "assistant",
        content: result.text,
        toolCalls: result.toolCalls,
      });
      measured = validUsage(result.usage)
        ? {
            count: messages.length,
            tokens:
              result.usage.totalTokens ||
              result.usage.promptTokens + result.usage.completionTokens,
          }
        : null;

      if (result.toolCalls.length === 0) {
        if (
          recordedHypotheses > 0 &&
          recordedFindings === 0 &&
          prematureStops < 2
        ) {
          prematureStops += 1;
          messages.push({
            id: nextId(),
            role: "user",
            content: `Pipeline check: you recorded ${recordedHypotheses} hypothesis(es) but no validated finding yet. Do not stop at the hypothesis phase. Validate the highest-ranked hypotheses now with the available validators. If a hypothesis cannot be validated, mark it blocked in your summary and continue with the next one.`,
          });
          continue;
        }
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
          truncated: outcome.metadata?.truncated ?? false,
          nextOffset: outcome.metadata?.nextOffset ?? null,
        });

        if (call.name === "finding_record" && outcome.ok) {
          const finding: AgentFinding = {
            title: String(call.arguments.title ?? ""),
            severity: String(call.arguments.severity ?? "low"),
            class: String(call.arguments.class ?? "other"),
            evidence: String(call.arguments.evidence ?? ""),
            validator: String(call.arguments.validator ?? ""),
          };
          addFinding(toolset.context.findings, finding);
          recordedFindings += 1;
          emit("finding", {
            title: finding.title,
            severity: finding.severity,
            class: finding.class,
            evidence: finding.evidence,
            validator: finding.validator,
            hypothesisId: call.arguments.hypothesisId ?? null,
          });
        }

        if (call.name === "hypothesis_record" && outcome.ok) {
          const hypothesis: AgentHypothesis = {
            statement: String(call.arguments.statement ?? ""),
            class: String(call.arguments.class ?? "other"),
            impact: Number(call.arguments.impact ?? 0),
            plausibility: Number(call.arguments.plausibility ?? 0),
            rationale: String(call.arguments.rationale ?? ""),
            evidence: String(call.arguments.evidence ?? ""),
            proposedTest: call.arguments.proposedTest
              ? String(call.arguments.proposedTest)
              : null,
          };
          addHypothesis(toolset.context.hypotheses, hypothesis);
          recordedHypotheses += 1;
          emit("hypothesis", {
            statement: hypothesis.statement,
            class: hypothesis.class,
            impact: hypothesis.impact,
            plausibility: hypothesis.plausibility,
            rationale: hypothesis.rationale,
            evidence: hypothesis.evidence,
            proposedTest: hypothesis.proposedTest,
          });
        }

        messages.push({
          id: nextId(),
          role: "tool",
          toolCallId: call.id,
          content,
        });
      }
    }
  } finally {
    (background as BackgroundSummary | null)?.controller.abort();
    background = null;
    backgroundAbort.abort();
    signal.removeEventListener("abort", onAbort);
  }
}
