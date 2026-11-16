import { useCallback, useEffect, useState } from "react";
import type { Artifact, Run, Workspace } from "../../shared/types";
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
  onRun: (run: Run) => void;
}

export function WorkspaceDetail({
  id,
  onBack,
  onArchived,
  onRun,
}: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await window.defensity.getWorkspace(id);
      setWorkspace(found);
      setRuns(found ? await window.defensity.listRuns(id) : []);
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

  async function startAnalysis() {
    if (!workspace) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const run = await window.defensity.startRun(workspace.id);
      onRun(run);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  }

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

      <Panel
        title="Analysis"
        meta={
          runs.some((run) => run.status === "running")
            ? "run in progress"
            : "agent core, M1"
        }
      >
        <div className="stack">
          <p className="hint">
            The agent reads the artifacts with scoped tools and reports every step.
            Model, provider and thinking come from the workspace.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button
              variant="primary"
              disabled={
                starting ||
                !workspace.provider ||
                !workspace.model ||
                runs.some((run) => run.status === "running")
              }
              onClick={() => void startAnalysis()}
            >
              {starting ? "Starting…" : "Run analysis"}
            </Button>
            {!workspace.provider || !workspace.model ? (
              <span className="hint">Choose a model before running.</span>
            ) : null}
          </div>
          {error ? <div className="alert">{error}</div> : null}
        </div>
      </Panel>

      <Panel title="Runs" meta={`${runs.length} recent`} flush>
        {runs.length === 0 ? (
          <div className="panel-body">No runs yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Status</th>
                  <th>Model</th>
                  <th style={{ width: 175 }}>Started</th>
                  <th style={{ width: 110 }}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onRun(run)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRun(run);
                      }
                    }}
                  >
                    <td>
                      <span className={`chip run-status run-status--${run.status}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="cell-mono">{run.model ?? "—"}</td>
                    <td className="cell-muted">{formatDate(run.createdAt)}</td>
                    <td className="cell-mono">
                      {run.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
