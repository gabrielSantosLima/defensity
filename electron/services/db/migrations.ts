import type { DatabaseSync } from "node:sqlite";

export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('web', 'android', 'library')),
    target_url TEXT,
    target_apk_path TEXT,
    library_artifact_path TEXT,
    library_artifact_kind TEXT,
    source_path TEXT,
    docs_path TEXT,
    provider TEXT,
    model TEXT,
    authorized_at TEXT,
    authorization_note TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT,
    size INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS artifacts_workspace_idx ON artifacts(workspace_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `ALTER TABLE workspaces ADD COLUMN thinking TEXT;`,
  `
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    thinking TEXT,
    started_at TEXT,
    ended_at TEXT,
    error TEXT,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    step_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS runs_workspace_idx ON runs(workspace_id);

  CREATE TABLE IF NOT EXISTS run_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS run_events_run_idx ON run_events(run_id, seq);

  `,
  `
  CREATE TABLE IF NOT EXISTS hypotheses (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    class TEXT NOT NULL,
    impact INTEGER NOT NULL,
    plausibility INTEGER NOT NULL,
    rationale TEXT NOT NULL,
    evidence TEXT NOT NULL,
    proposed_test TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS hypotheses_run_idx ON hypotheses(run_id);
  `,
  `
  CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    hypothesis_id TEXT,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    class TEXT NOT NULL,
    evidence TEXT NOT NULL,
    validator TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS findings_run_idx ON findings(run_id);
  `,
  `ALTER TABLE runs ADD COLUMN rerun_of TEXT;`,
];

export function runMigrations(database: DatabaseSync): void {
  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  let version = row?.user_version ?? 0;

  for (let index = version; index < MIGRATIONS.length; index += 1) {
    database.exec(MIGRATIONS[index]);
    version = index + 1;
    database.exec(`PRAGMA user_version = ${version}`);
  }
}
