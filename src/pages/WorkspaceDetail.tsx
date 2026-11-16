import { useCallback, useEffect, useState } from "react";
import type { Artifact, Workspace } from "../../shared/types";
import { Button } from "../components/Button";
import { Panel } from "../components/ui";
import { errorMessage, formatBytes, formatDate, shortHash } from "../lib/format";

const ARTIFACT_LABEL: Record<Artifact["kind"], string> = {
  source: "Source",
  docs: "Docs",
  url: "URL",
  apk: "APK",
  lockfile: "Lockfile",
  sbom: "SBOM",
  tarball: "Tarball",
};

const TYPE_LABEL: Record<Workspace["type"], string> = {
  web: "Web",
  android: "Android",
  library: "Library",
};

interface WorkspaceDetailProps {
  id: string;
  onBack: () => void;
  onArchived: () => void;
}

export function WorkspaceDetail({
  id,
  onBack,
  onArchived,
}: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await window.defensity.getWorkspace(id);
      setWorkspace(found);
      setError(found ? null : "This workspace no longer exists.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive() {
    if (!workspace) {
      return;
    }
    const confirmed = window.confirm(
      `Archive "${workspace.name}"? It disappears from the list, but its data is kept.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await window.defensity.archiveWorkspace(workspace.id);
      onArchived();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="panel-body">Loading workspace…</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="page">
        <div className="alert">{error ?? "Workspace not found."}</div>
        <div>
          <Button variant="secondary" onClick={onBack}>
            Back to workspaces
          </Button>
        </div>
      </div>
    );
  }

  const target =
    workspace.type === "web"
      ? workspace.targetUrl
      : workspace.type === "android"
        ? workspace.targetApkPath
        : workspace.libraryArtifactPath;

  return (
    <div className="page">
      <div className="page-head">
        <div className="detail-meta">
          <span className="chip chip--accent">{TYPE_LABEL[workspace.type]}</span>
          <span className="cell-mono">{target ?? "—"}</span>
          <span>·</span>
          <span>updated {formatDate(workspace.updatedAt)}</span>
        </div>
        <div className="page-head-actions">
          <Button variant="danger" size="sm" onClick={() => void archive()}>
            Archive
          </Button>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div className="grid-2">
        <Panel title="Target">
          <dl className="kv">
            <dt>Type</dt>
            <dd>{TYPE_LABEL[workspace.type]}</dd>
            <dt>Target</dt>
            <dd className="mono">{target ?? "—"}</dd>
            {workspace.type === "library" ? (
              <>
                <dt>Format</dt>
                <dd>{workspace.libraryArtifactKind ?? "—"}</dd>
              </>
            ) : null}
            <dt>Source</dt>
            <dd className="mono">{workspace.sourcePath ?? "black-box"}</dd>
            <dt>Documentation</dt>
            <dd className="mono">{workspace.docsPath ?? "none"}</dd>
            <dt>Model</dt>
            <dd>
              {workspace.provider ?? "not chosen"}
              {workspace.model ? ` · ${workspace.model}` : ""}
            </dd>
            <dt>Thinking</dt>
            <dd>{workspace.thinking ?? "off"}</dd>
            <dt>Created</dt>
            <dd className="mono">{formatDate(workspace.createdAt)}</dd>
          </dl>
        </Panel>

        <Panel title="Authorization">
          <dl className="kv">
            <dt>Recorded</dt>
            <dd className="mono">{formatDate(workspace.createdAt)}</dd>
            <dt>Note</dt>
            <dd>{workspace.authorizationNote ?? "—"}</dd>
            <dt>Scope</dt>
            <dd>Frozen per run; tools cannot leave it.</dd>
          </dl>
        </Panel>
      </div>

      <Panel
        title="Artifacts"
        meta={`${workspace.artifacts.length} registered`}
        flush
      >
        {workspace.artifacts.length === 0 ? (
          <div className="panel-body">No artifacts registered.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Kind</th>
                  <th>Path</th>
                  <th style={{ width: 130 }}>SHA-256</th>
                  <th style={{ width: 80 }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {workspace.artifacts.map((artifact) => (
                  <tr key={artifact.id}>
                    <td>
                      <span className="chip">{ARTIFACT_LABEL[artifact.kind]}</span>
                    </td>
                    <td className="cell-mono">{artifact.path}</td>
                    <td className="cell-muted">{shortHash(artifact.hash)}</td>
                    <td className="cell-mono">{formatBytes(artifact.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Analysis" meta="agent runs arrive in M1">
        <div className="stack">
          <p className="hint">
            The analysis cycle reads the artifacts, forms hypotheses and validates
            them in a container. Model and provider are chosen per workspace
            before the first run.
          </p>
          <div>
            <Button variant="secondary" disabled>
              Run analysis
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
