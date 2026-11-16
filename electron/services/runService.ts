import type { DatabaseSync } from "node:sqlite";
import type {
  ProviderId,
  Run,
  RunEvent,
  RunEventType,
  RunStatus,
  ThinkingLevel,
} from "../../shared/types";

export interface RunService {
  create(run: Run): void;
  get(id: string): Run | null;
  listByWorkspace(workspaceId: string): Run[];
  listActive(): Run[];
  deleteByWorkspace(workspaceId: string): void;
  setStatus(
    id: string,
    status: RunStatus,
    patch?: { endedAt?: string; error?: string },
  ): void;
  addUsage(
    id: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  ): void;
  setStepCount(id: string, steps: number): void;
  appendEvent(event: {
    id: string;
    runId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
    createdAt: string;
  }): number;
  listEvents(runId: string): RunEvent[];
}

interface RunRow {
  id: string;
  workspace_id: string;
  status: RunStatus;
  provider: ProviderId | null;
  model: string | null;
  thinking: ThinkingLevel | null;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  step_count: number;
  rerun_of: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  run_id: string;
  seq: number;
  type: RunEventType;
  payload: string;
  created_at: string;
}

function toRun(row: RunRow): Run {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    thinking: row.thinking,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    error: row.error,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    stepCount: row.step_count,
    rerunOf: row.rerun_of,
    createdAt: row.created_at,
  };
}

function toEvent(row: EventRow): RunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    seq: row.seq,
    type: row.type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function createRunService(database: DatabaseSync): RunService {
  return {
    create(run) {
      database
        .prepare(
          `INSERT INTO runs (
            id, workspace_id, status, provider, model, thinking, started_at,
            ended_at, error, prompt_tokens, completion_tokens, total_tokens,
            step_count, rerun_of, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          run.id,
          run.workspaceId,
          run.status,
          run.provider,
          run.model,
          run.thinking,
          run.startedAt,
          run.endedAt,
          run.error,
          run.promptTokens,
          run.completionTokens,
          run.totalTokens,
          run.stepCount,
          run.rerunOf,
          run.createdAt,
        );
    },

    get(id) {
      const row = database
        .prepare("SELECT * FROM runs WHERE id = ?")
        .get(id) as unknown as RunRow | undefined;
      return row ? toRun(row) : null;
    },

    listByWorkspace(workspaceId) {
      const rows = database
        .prepare(
          "SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20",
        )
        .all(workspaceId) as unknown as RunRow[];
      return rows.map(toRun);
    },

    deleteByWorkspace(workspaceId) {
      database.prepare("DELETE FROM runs WHERE workspace_id = ?").run(workspaceId);
    },

    listActive() {
      const rows = database
        .prepare(
          "SELECT * FROM runs WHERE status IN ('queued', 'running') ORDER BY created_at ASC",
        )
        .all() as unknown as RunRow[];
      return rows.map(toRun);
    },

    setStatus(id, status, patch) {
      database
        .prepare(
          `UPDATE runs SET status = ?, ended_at = COALESCE(?, ended_at),
             error = COALESCE(?, error) WHERE id = ?`,
        )
        .run(status, patch?.endedAt ?? null, patch?.error ?? null, id);
    },

    addUsage(id, usage) {
      database
        .prepare(
          `UPDATE runs SET prompt_tokens = prompt_tokens + ?,
             completion_tokens = completion_tokens + ?,
             total_tokens = total_tokens + ? WHERE id = ?`,
        )
        .run(usage.promptTokens, usage.completionTokens, usage.totalTokens, id);
    },

    setStepCount(id, steps) {
      database.prepare("UPDATE runs SET step_count = ? WHERE id = ?").run(steps, id);
    },

    appendEvent(event) {
      const row = database
        .prepare(
          "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM run_events WHERE run_id = ?",
        )
        .get(event.runId) as unknown as { seq: number };
      database
        .prepare(
          `INSERT INTO run_events (id, run_id, seq, type, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.runId,
          row.seq,
          event.type,
          JSON.stringify(event.payload),
          event.createdAt,
        );
      return row.seq;
    },

    listEvents(runId) {
      const rows = database
        .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY seq ASC")
        .all(runId) as unknown as EventRow[];
      return rows.map(toEvent);
    },
  };
}
