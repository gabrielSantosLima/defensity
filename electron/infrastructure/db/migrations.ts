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
