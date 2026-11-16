import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Finding,
  Hypothesis,
  Run,
  RunEvent,
  RunUpdate,
} from "../../shared/types";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { Panel } from "../components/ui";
import { errorMessage } from "../lib/format";

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
  onBack: () => void;
}

export function RunConsole({
  runId,
  workspaceName,
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
  const endRef = useRef<HTMLDivElement | null>(null);

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
    endRef.current?.scrollIntoView({ block: "end" });
  }, [events.length, live]);

  async function cancel() {
    try {
      await window.defensity.cancelRun(runId);
    } catch (caught) {
      setError(errorMessage(caught));
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
          </span>
          <pre className="tl-pre">{String(event.payload.preview ?? "")}</pre>
        </div>
      );
    }
    if (event.type === "assistant.message") {
      return (
        <div className="tl-text" key={event.id}>
          {String(event.payload.text ?? "")}
        </div>
      );
    }
    if (event.type === "finding") {
      const severity = String(event.payload.severity ?? "low");
      return (
        <div className={`tl-finding tl-finding--${severity}`} key={event.id}>
          <div className="tl-finding-head">
            <span className="chip">{severity}</span>
            <span className="tl-finding-validator">
              via {String(event.payload.validator ?? "unknown")}
            </span>
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
      return (
        <div className="tl-usage" key={event.id}>
          context compacted ·{" "}
          {Number(event.payload.tokensBefore ?? 0).toLocaleString()} →{" "}
          {Number(event.payload.tokensAfter ?? 0).toLocaleString()} tokens ·{" "}
          {Number(event.payload.removedMessages ?? 0)} messages summarized
        </div>
      );
    }
    if (event.type === "usage") {
      return (
        <div className="tl-usage" key={event.id}>
          +{Number(event.payload.totalTokens ?? 0)} tokens (
          {Number(event.payload.promptTokens ?? 0)} in /{" "}
          {Number(event.payload.completionTokens ?? 0)} out)
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
  const lastGroup = [...blocks]
    .reverse()
    .find((block) => block.type === "group");

  return (
    <>
      <header className="run-head">
        <div className="run-head-inner">
          <div className="run-identity">
            <span className="run-project">{workspaceName}</span>
            <span className={`chip run-status run-status--${run.status}`}>
              {run.status}
            </span>
          </div>
          <div className="run-stats">
            <span>{run.provider ?? "—"} · {run.model ?? "—"}</span>
            <span>·</span>
            <span>{elapsed(run, now)}</span>
            <span>·</span>
            <span>{run.totalTokens.toLocaleString()} tokens</span>
            <span>·</span>
            <span>
              {findings.length} issue{findings.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              {hypotheses.length} hypothes
              {hypotheses.length === 1 ? "is" : "es"}
            </span>
          </div>
          <div className="run-actions">
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

      <div className="page run-page">

      {error ? <div className="alert">{error}</div> : null}

      <Panel title="Timeline" meta={`${run.stepCount || 0} steps`}>
        <div className="timeline">
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
            const open = running && block === lastGroup;

            return (
              <details className="exec" key={block.key} open={open}>
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
              {live}
              <span className="caret" />
            </div>
          ) : null}

          {running ? <div className="tl-usage">agent working…</div> : null}
          <div ref={endRef} />
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
    </>
  );
}
