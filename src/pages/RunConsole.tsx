import { useCallback, useEffect, useRef, useState } from "react";
import type { Run, RunEvent, RunUpdate } from "../../shared/types";
import { Button } from "../components/Button";
import { Panel } from "../components/ui";
import { errorMessage } from "../lib/format";

function elapsed(run: Run, now: number): string {
  if (!run.startedAt) {
    return "—";
  }
  const end = run.endedAt ? new Date(run.endedAt).getTime() : now;
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function isEvent(update: RunUpdate): update is RunEvent {
  return "id" in update;
}

interface RunConsoleProps {
  runId: string;
  onBack: () => void;
}

export function RunConsole({ runId, onBack }: RunConsoleProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [live, setLive] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [current, history] = await Promise.all([
        window.defensity.getRun(runId),
        window.defensity.listRunEvents(runId),
      ]);
      setRun(current);
      setEvents(history);
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

  if (!run) {
    return (
      <div className="page">
        <div className="panel-body">{error ?? "Loading run…"}</div>
      </div>
    );
  }

  const running = run.status === "running";

  return (
    <div className="page">
      <div className="page-head">
        <div className="detail-meta">
          <span className={`chip run-status run-status--${run.status}`}>
            {run.status}
          </span>
          <span className="cell-mono">
            {run.provider ?? "—"} · {run.model ?? "—"}
          </span>
          <span>·</span>
          <span>{elapsed(run, now)}</span>
          <span>·</span>
          <span>{run.totalTokens.toLocaleString()} tokens</span>
        </div>
        <div className="page-head-actions">
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

      {error ? <div className="alert">{error}</div> : null}

      <Panel
        title="Timeline"
        meta={`${run.stepCount || 0} step${run.stepCount === 1 ? "" : "s"}`}
      >
        <div className="timeline">
          {events.length === 0 && !live ? (
            <p className="hint">
              Waiting for the agent to report its first step…
            </p>
          ) : null}

          {events.map((event) => {
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
                    {ok ? "result" : "error"} ·{" "}
                    {String(event.payload.chars ?? 0)} chars
                  </span>
                  <pre className="tl-pre">
                    {String(event.payload.preview ?? "")}
                  </pre>
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
          })}

          {live ? (
            <div className="tl-text tl-text--live">
              {live}
              <span className="caret" />
            </div>
          ) : null}

          {running ? (
            <div className="tl-usage">agent working…</div>
          ) : null}
          <div ref={endRef} />
        </div>
      </Panel>
    </div>
  );
}
