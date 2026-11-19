import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { ArrowDown, Play } from "lucide-react";
import type {
  Finding,
  Hypothesis,
  Run,
  RunEvent,
  RunUpdate,
} from "../../shared/types";
import { Button } from "../components/Button";
import { AgentMark } from "../components/AgentMark";
import { Markdown } from "../components/Markdown";
import { Spinner } from "../components/Spinner";
import { TokenUsage } from "../components/TokenUsage";
import { Panel } from "../components/ui";
import { errorMessage, formatCompact } from "../lib/format";

const compactTokens = (value: number) => formatCompact(value);

function elapsed(run: Run, now: number): string {
  if (!run.startedAt) {
    return "—";
  }
  const end = run.endedAt ? new Date(run.endedAt).getTime() : now;
  const seconds = Math.max(
    0,
    Math.round((end - new Date(run.startedAt).getTime()) / 1000),
  );
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function isEvent(update: RunUpdate): update is RunEvent {
  return "id" in update;
}

type Block =
  | { type: "group"; key: string; events: RunEvent[] }
  | { type: "event"; event: RunEvent };

const EXEC_TYPES = new Set(["tool.call", "tool.result"]);

function groupEvents(events: RunEvent[]): Block[] {
  const blocks: Block[] = [];
  let current: Extract<Block, { type: "group" }> | null = null;

  for (const event of events) {
    if (EXEC_TYPES.has(event.type)) {
      if (!current) {
        current = { type: "group", key: event.id, events: [] };
        blocks.push(current);
      }
      current.events.push(event);
      continue;
    }
    current = null;
    blocks.push({ type: "event", event });
  }
  return blocks;
}

interface RunConsoleProps {
  runId: string;
  workspaceName: string;
  onRerun: (runId: string) => void;
  onBack: () => void;
}

export function RunConsole({
  runId,
  workspaceName,
  onRerun,
  onBack,
}: RunConsoleProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [pinned, setPinned] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const followFrameRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [current, history, found, confirmed] = await Promise.all([
        window.defensity.getRun(runId),
        window.defensity.listRunEvents(runId),
        window.defensity.listHypotheses(runId),
        window.defensity.listFindings(runId),
      ]);
      setRun(current);
      setEvents(history);
      setHypotheses(found);
      setFindings(confirmed);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = window.defensity.onRunUpdate((update) => {
      if (update.runId !== runId) {
        return;
      }
      if (!isEvent(update)) {
        setLive((current) => current + update.text);
        return;
      }
      setEvents((current) =>
        current.some((event) => event.id === update.id)
          ? current
          : [...current, update],
      );
      if (update.type === "assistant.message") {
        setLive("");
      }
      if (update.type.startsWith("run.") || update.type === "usage") {
        void refresh();
      }
    });
    return unsubscribe;
  }, [runId, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (run?.status !== "running") {
      return;
    }
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [run?.status, refresh]);

  useEffect(() => {
    pinnedRef.current = true;
    setPinned(true);
    setLive("");
    setError(null);
  }, [runId]);

  const stopFollow = useCallback(() => {
    if (followFrameRef.current !== null) {
      window.cancelAnimationFrame(followFrameRef.current);
      followFrameRef.current = null;
    }
  }, []);

  /**
   * Eases the viewport toward the end of the conversation instead of assigning
   * scrollTop in one jump. It runs while the content grows, so streamed text
   * and tool results scroll smoothly with the chat.
   */
  const followEnd = useCallback(() => {
    if (!pinnedRef.current || followFrameRef.current !== null) {
      return;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const step = () => {
      followFrameRef.current = null;
      const scroller = scrollerRef.current;
      if (!scroller || !pinnedRef.current) {
        return;
      }
      const target = scroller.scrollHeight - scroller.clientHeight;
      const distance = target - scroller.scrollTop;
      if (distance <= 0.5) {
        return;
      }
      const increment = reduced
        ? distance
        : Math.min(distance, Math.max(1.5, distance * 0.2));
      scroller.scrollTop = Math.min(target, scroller.scrollTop + increment);
      followFrameRef.current = window.requestAnimationFrame(step);
    };

    followFrameRef.current = window.requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      followEnd();
    }
  }, [events.length, live, hypotheses.length, findings.length, followEnd]);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) {
        followEnd();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [run?.id, followEnd]);

  useEffect(() => stopFollow, [stopFollow]);

  function handleScroll() {
    if (followFrameRef.current !== null) {
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const atBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 96;
    // Only re-attach on scroll. Detaching is driven by user gestures
    // (wheel up, scrollbar drag), so layout shifts cannot unpin the timeline.
    if (atBottom && !pinnedRef.current) {
      pinnedRef.current = true;
      setPinned(true);
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (event.deltaY >= 0) {
      return;
    }
    stopFollow();
    if (pinnedRef.current) {
      pinnedRef.current = false;
      setPinned(false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // A pointer down on the scroller itself is a scrollbar interaction. Clicks
    // inside the conversation keep following the stream.
    if (event.target !== scrollerRef.current) {
      return;
    }
    stopFollow();
    pinnedRef.current = false;
    setPinned(false);
  }

  function scrollToLatest() {
    pinnedRef.current = true;
    setPinned(true);
    stopFollow();
    followEnd();
  }

  async function cancel() {
    try {
      await window.defensity.cancelRun(runId);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function rerun() {
    setRerunning(true);
    setError(null);
    try {
      const next = await window.defensity.rerunRun(runId);
      onRerun(next.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRerunning(false);
    }
  }

  async function continueRun() {
    setContinuing(true);
    setError(null);
    try {
      const next = await window.defensity.continueRun(runId);
      setRun(next);
      void refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setContinuing(false);
    }
  }

  async function openReport() {
    try {
      setReportPath(null);
      setReport(await window.defensity.generateReport(runId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function saveReport() {
    try {
      setReportPath(await window.defensity.saveReport(runId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function renderEvent(event: RunEvent) {
    if (event.type === "step.started") {
      return (
        <div className="tl-step" key={event.id}>
          step {String(event.payload.step ?? "?")}
        </div>
      );
    }
    if (event.type === "tool.call") {
      return (
        <div className="tl-tool" key={event.id}>
          <div className="tl-tool-head">
            <span className="tl-tool-name">
              {String(event.payload.name ?? "tool")}
            </span>
            <span className="tl-tool-args">
              {JSON.stringify(event.payload.arguments ?? {})}
            </span>
          </div>
        </div>
      );
    }
    if (event.type === "tool.result") {
      const ok = event.payload.ok !== false;
      return (
        <div
          className={`tl-result${ok ? "" : " tl-result--error"}`}
          key={event.id}
        >
          <span className="tl-result-meta">
            {ok ? "result" : "error"} · {String(event.payload.chars ?? 0)} chars
            {event.payload.nextOffset
              ? ` · next offset ${String(event.payload.nextOffset)}`
              : ""}
          </span>
          <pre className="tl-pre">{String(event.payload.preview ?? "")}</pre>
        </div>
      );
    }
    if (event.type === "assistant.message") {
      return (
        <div className="tl-text" key={event.id}>
          <Markdown>{String(event.payload.text ?? "")}</Markdown>
        </div>
      );
    }
    if (event.type === "finding") {
      const severity = String(event.payload.severity ?? "low");
      const duplicate = event.payload.duplicate === true;
      return (
        <div className={`tl-finding tl-finding--${severity}`} key={event.id}>
          <div className="tl-finding-head">
            <span className="chip">{severity}</span>
            <span className="tl-finding-validator">
              via {String(event.payload.validator ?? "unknown")}
            </span>
            {duplicate ? (
              <span className="chip chip--muted">already registered</span>
            ) : null}
          </div>
          <p className="tl-finding-title">
            {String(event.payload.title ?? "")}
          </p>
          <pre className="tl-pre">{String(event.payload.evidence ?? "")}</pre>
        </div>
      );
    }
    if (event.type === "hypothesis") {
      const impact = Number(event.payload.impact ?? 0);
      const plausibility = Number(event.payload.plausibility ?? 0);
      const evidence = String(event.payload.evidence ?? "");
      const proposedTest = event.payload.proposedTest
        ? String(event.payload.proposedTest)
        : null;
      return (
        <div className="tl-hypothesis" key={event.id}>
          <div className="tl-hyp-head">
            <span className="chip chip--accent">
              {String(event.payload.class ?? "other")}
            </span>
            <span className="tl-hyp-score">{impact * plausibility}/25</span>
          </div>
          <p className="tl-hyp-statement">
            {String(event.payload.statement ?? "")}
          </p>
          <p className="tl-hyp-rationale">
            {String(event.payload.rationale ?? "")}
          </p>
          {evidence ? <pre className="tl-pre">{evidence}</pre> : null}
          {proposedTest ? (
            <p className="tl-hyp-test">test: {proposedTest}</p>
          ) : null}
          <span className="tl-hyp-rank">
            impact {impact} · plausibility {plausibility}
          </span>
        </div>
      );
    }
    if (event.type === "compaction") {
      const mode = String(event.payload.mode ?? "auto");
      const summary = String(event.payload.summary ?? "");
      const fallback = event.payload.fallback === true;
      return (
        <details className="tl-compaction" key={event.id}>
          <summary className="tl-compaction-summary">
            context compacted · {mode}
            {event.payload.usedBackground === true ? " · precomputed" : ""} ·{" "}
            {Number(event.payload.tokensBefore ?? 0).toLocaleString()} →{" "}
            {Number(event.payload.tokensAfter ?? 0).toLocaleString()} tokens ·{" "}
            {Number(event.payload.removedMessages ?? 0)} messages summarized
            {fallback ? " · fallback" : ""}
          </summary>
          <pre className="tl-pre">
            {summary || "No summary was recorded for this compaction."}
          </pre>
        </details>
      );
    }
    if (event.type === "usage") {
      const compaction = event.payload.compaction === true;
      return (
        <div className="tl-usage" key={event.id}>
          {compaction ? "compaction summary" : "request"} ·{" "}
          {Number(event.payload.totalTokens ?? 0).toLocaleString()} tokens (
          {Number(event.payload.promptTokens ?? 0).toLocaleString()} in /{" "}
          {Number(event.payload.completionTokens ?? 0).toLocaleString()} out)
        </div>
      );
    }
    return (
      <div className="tl-status" key={event.id}>
        {event.type.replace("run.", "run ")}
        {event.payload.error ? ` — ${String(event.payload.error)}` : ""}
      </div>
    );
  }

  if (!run) {
    return (
      <div className="page">
        <div className="panel-body loading-inline">
          <Spinner />
          {error ?? "Loading run…"}
        </div>
      </div>
    );
  }

  const running = run.status === "running";
  const blocks = groupEvents(
    events.filter(
      (event) =>
        !(
          (event.type === "tool.call" || event.type === "tool.result") &&
          (event.payload.name === "hypothesis_record" ||
            event.payload.name === "finding_record")
        ),
    ),
  );
  const latestStep = [...events]
    .reverse()
    .find((event) => event.type === "step.started");
  const latestUsage = [...events]
    .reverse()
    .find((event) => event.type === "usage");
  const contextTokens = Number(
    latestStep?.payload.estimatedTokens ??
      latestUsage?.payload.promptTokens ??
      0,
  );
  const contextCeiling = Number(latestStep?.payload.ceiling ?? 0);

  return (
    <div className="run-console">
      <header className="run-head">
        <div className="run-head-inner">
          <div className="run-identity">
            <span className="run-project">{workspaceName}</span>
            <span className={`chip run-status run-status--${run.status}`}>
              {run.status}
            </span>
            {run.rerunOf ? (
              <span className="chip chip--muted">continued</span>
            ) : null}
          </div>
          <div className="run-stats">
            <div className="run-metric run-metric--model">
              <span className="run-metric-label">Model</span>
              <span
                className="run-metric-value"
                title={`${run.provider ?? "—"} · ${run.model ?? "—"}`}
              >
                {run.provider ?? "—"} · {run.model ?? "—"}
              </span>
            </div>
            <div className="run-metric run-metric--elapsed">
              <span className="run-metric-label">Elapsed</span>
              <span className="run-metric-value">{elapsed(run, now)}</span>
            </div>
            <div className="run-metric run-metric--usage">
              <div className="run-metric-copy">
                <span className="run-metric-label">Usage</span>
                <span
                  className="run-metric-value"
                  title={`${run.totalTokens.toLocaleString()} tokens billed across every model call`}
                >
                  {compactTokens(run.totalTokens)} billed
                </span>
              </div>
              <TokenUsage
                used={contextTokens}
                limit={contextCeiling}
                billed={run.totalTokens}
              />
            </div>
            <div className="run-metric">
              <span className="run-metric-label">Results</span>
              <span className="run-metric-value">
                {findings.length} issue{findings.length === 1 ? "" : "s"} ·{" "}
                {hypotheses.length} hypothes
                {hypotheses.length === 1 ? "is" : "es"}
              </span>
            </div>
          </div>
          <div className="run-actions">
            {!running ? (
              <Button
                variant="secondary"
                size="sm"
                loading={rerunning}
                onClick={() => void rerun()}
              >
                Rerun
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void openReport()}
            >
              Report
            </Button>
            {running ? (
              <Button variant="danger" size="sm" onClick={() => void cancel()}>
                Cancel run
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </header>

      <div
        className="run-scroll"
        ref={scrollerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
      >
        <div className="page run-page">

      {error ? <div className="alert">{error}</div> : null}

      <Panel title="Timeline" meta={`${run.stepCount || 0} steps`}>
        <div className="timeline" ref={timelineRef}>
          {events.length === 0 && !live ? (
            <p className="hint">Waiting for the agent to report its first step…</p>
          ) : null}

          {blocks.map((block) => {
            if (block.type === "event") {
              return renderEvent(block.event);
            }

            const calls = block.events.filter(
              (event) => event.type === "tool.call",
            );
            const names = [
              ...new Set(calls.map((event) => String(event.payload.name))),
            ];

            return (
              <details className="exec" key={block.key}>
                <summary className="exec-summary">
                  <span className="exec-title">
                    {calls.length} tool call{calls.length === 1 ? "" : "s"}
                  </span>
                  <span className="exec-names">{names.join(", ")}</span>
                </summary>
                <div className="exec-body">
                  {block.events.map((event) => renderEvent(event))}
                </div>
              </details>
            );
          })}

          {live ? (
            <div className="tl-text tl-text--live">
              <Markdown>{live}</Markdown>
              <span className="caret" />
            </div>
          ) : null}

          {running ? (
            <div className="agent-status">
              <AgentMark size={12} />
              <span>agent executing</span>
            </div>
          ) : null}

          {run.status === "completed" ? (
            <div className="continue-bar">
              <Button
                variant="secondary"
                size="sm"
                loading={continuing}
                onClick={() => void continueRun()}
              >
                <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                Continue
              </Button>
              <span className="hint">
                Continue this same run with the current conversation, hypotheses
                and findings already in context.
              </span>
            </div>
          ) : null}
        </div>
      </Panel>

      {report !== null ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReport(null);
            }
          }}
        >
          <div className="modal report-modal" role="dialog" aria-modal="true">
            <header className="modal-head">
              <span>Report</span>
              <Button size="sm" variant="ghost" onClick={() => setReport(null)}>
                Close
              </Button>
            </header>
            <div className="report-body">
              <pre>{report}</pre>
            </div>
            <footer className="model-foot">
              <span className="lbl">
                {reportPath ?? `${report.length} characters`}
              </span>
              <span style={{ flex: 1 }} />
              <Button size="sm" variant="primary" onClick={() => void saveReport()}>
                Save as Markdown
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
        </div>
      </div>

      {!pinned && events.length > 0 ? (
        <button
          type="button"
          className="jump-latest"
          aria-label="Jump to latest"
          title="Jump to latest"
          onClick={scrollToLatest}
        >
          <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
