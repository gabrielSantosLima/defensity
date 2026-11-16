import type { DatabaseSync } from "node:sqlite";
import type {
  Artifact,
  ArtifactKind,
  LibraryArtifactKind,
  ProviderId,
  ThinkingLevel,
  Workspace,
  WorkspaceType,
} from "../../shared/types";

export interface WorkspaceService {
  list(): Workspace[];
  get(id: string): Workspace | null;
  insert(workspace: Workspace): void;
  archive(id: string, at: string): void;
}

interface WorkspaceRow {
  id: string;
  name: string;
  type: WorkspaceType;
  target_url: string | null;
  target_apk_path: string | null;
  library_artifact_path: string | null;
  library_artifact_kind: LibraryArtifactKind | null;
  source_path: string | null;
  docs_path: string | null;
  provider: ProviderId | null;
  model: string | null;
  thinking: ThinkingLevel | null;
  authorized_at: string | null;
  authorization_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactRow {
  id: string;
  workspace_id: string;
  kind: ArtifactKind;
  path: string;
  hash: string | null;
  size: number | null;
  created_at: string;
}

function toArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    path: row.path,
    hash: row.hash,
    size: row.size,
    createdAt: row.created_at,
  };
}

function toWorkspace(row: WorkspaceRow, artifacts: Artifact[]): Workspace {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    targetUrl: row.target_url,
    targetApkPath: row.target_apk_path,
    libraryArtifactPath: row.library_artifact_path,
    libraryArtifactKind: row.library_artifact_kind,
    sourcePath: row.source_path,
    docsPath: row.docs_path,
    provider: row.provider,
    model: row.model,
    thinking: row.thinking,
    authorizedAt: row.authorized_at,
    authorizationNote: row.authorization_note,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    artifacts,
  };
}

export function createWorkspaceService(
  database: DatabaseSync,
): WorkspaceService {
  function artifactsFor(workspaceId: string): Artifact[] {
    const rows = database
      .prepare(
        "SELECT * FROM artifacts WHERE workspace_id = ? ORDER BY created_at ASC, rowid ASC",
      )
      .all(workspaceId) as unknown as ArtifactRow[];
    return rows.map(toArtifact);
  }

  return {
    list() {
      const rows = database
        .prepare(
          "SELECT * FROM workspaces WHERE archived_at IS NULL ORDER BY updated_at DESC",
        )
        .all() as unknown as WorkspaceRow[];
      return rows.map((row) => toWorkspace(row, artifactsFor(row.id)));
    },

    get(id) {
      const row = database
        .prepare("SELECT * FROM workspaces WHERE id = ?")
        .get(id) as unknown as WorkspaceRow | undefined;
      return row ? toWorkspace(row, artifactsFor(row.id)) : null;
    },

    insert(workspace) {
      database.exec("BEGIN");
      try {
        database
          .prepare(
            `INSERT INTO workspaces (
              id, name, type, target_url, target_apk_path, library_artifact_path,
              library_artifact_kind, source_path, docs_path, provider, model,
              thinking, authorized_at, authorization_note, archived_at,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            workspace.id,
            workspace.name,
            workspace.type,
            workspace.targetUrl,
            workspace.targetApkPath,
            workspace.libraryArtifactPath,
            workspace.libraryArtifactKind,
            workspace.sourcePath,
            workspace.docsPath,
            workspace.provider,
            workspace.model,
            workspace.thinking,
            workspace.authorizedAt,
            workspace.authorizationNote,
            workspace.archivedAt,
            workspace.createdAt,
            workspace.updatedAt,
          );

        const insertArtifact = database.prepare(
          `INSERT INTO artifacts (id, workspace_id, kind, path, hash, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const artifact of workspace.artifacts) {
          insertArtifact.run(
            artifact.id,
            artifact.workspaceId,
            artifact.kind,
            artifact.path,
            artifact.hash,
            artifact.size,
            artifact.createdAt,
          );
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    archive(id, at) {
      database
        .prepare(
          "UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(at, at, id);
    },
  };
}
