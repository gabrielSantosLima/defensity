import { useCallback, useEffect, useState } from "react";
import type { Artifact, Finding, Run, SandboxStatus, Workspace } from "../../shared/types";
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
  onDeleted: () => void;
  onOpenSettings: () => void;
  onEdit: () => void;
  onRun: (run: Run) => void;
  onOpenRun: (runId: string) => void;
}

export function WorkspaceDetail({
  id,
  onBack,
  onArchived,
  onDeleted,
  onOpenSettings,
  onEdit,
  onRun,
  onOpenRun,
}: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [issues, setIssues] = useState<Finding[]>([]);
  const [sandbox, setSandbox] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await window.defensity.getWorkspace(id);
      setWorkspace(found);
      if (found) {
        const [runList, issueList] = await Promise.all([
          window.defensity.listRuns(id),
          window.defensity.listWorkspaceIssues(id),
        ]);
        setRuns(runList);
        setIssues(issueList);
      } else {
        setRuns([]);
        setIssues([]);
      }
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

  const loadSandbox = useCallback(async () => {
    try {
      setSandbox(await window.defensity.getSandboxStatus());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    if (workspace?.type === "web") {
      void loadSandbox();
    }
  }, [workspace?.type, loadSandbox]);

  async function clearHistory() {
    if (!workspace) {
      return;
    }
    if (
      !window.confirm(
        `Delete all runs and issues for "${workspace.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await window.defensity.clearRunHistory(workspace.id);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function removeWorkspace() {
    if (!workspace) {
      return;
    }
    if (
      !window.confirm(
        `Delete "${workspace.name}" permanently? Runs, issues and artifacts will be removed.`,
      )
    ) {
      return;
    }
    try {
      await window.defensity.deleteWorkspace(workspace.id);
      onDeleted();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

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
          {workspace.type === "web" && workspace.targetUrl ? (
            <a
              className="link cell-mono"
              href={workspace.targetUrl}
              onClick={(event) => {
                event.preventDefault();
                void window.defensity.openExternal(
                  workspace.targetUrl as string,
                );
              }}
            >
              {workspace.targetUrl}
            </a>
          ) : (
            <span className="cell-mono">{target ?? "—"}</span>
          )}
          <span>·</span>
          <span>updated {formatDate(workspace.updatedAt)}</span>
        </div>
        <div className="page-head-actions">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void clearHistory()}>
            Clear runs
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void archive()}>
            Archive
          </Button>
          <Button variant="danger" size="sm" onClick={() => void removeWorkspace()}>
            Delete
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
            <dd className="mono">
              {workspace.type === "web" && workspace.targetUrl ? (
                <a
                  className="link"
                  href={workspace.targetUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    void window.defensity.openExternal(
                      workspace.targetUrl as string,
                    );
                  }}
                >
                  {workspace.targetUrl}
                </a>
              ) : (
                (target ?? "—")
              )}
            </dd>
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
          {workspace.type === "web" && sandbox && !sandbox.ready ? (
            <div className="alert alert--info">
              <div>
                Validation needs Docker and the sandbox images.{" "}
                {sandbox.dockerAvailable
                  ? "The images are not built yet."
                  : "Docker is not reachable."}{" "}
                Open Settings → Validation sandbox to fix the setup.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onOpenSettings}
                >
                  Open sandbox settings
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void loadSandbox()}>
                  Check again
                </Button>
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button
              variant="primary"
              loading={starting}
              disabled={
                !workspace.provider ||
                !workspace.model ||
                runs.some((run) => run.status === "running") ||
                (workspace.type === "web" && sandbox !== null && !sandbox.ready)
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

      <Panel title="Issues" meta={`${issues.length} registered`} flush>
        {issues.length === 0 ? (
          <div className="panel-body">No validated issues yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Severity</th>
                  <th>Issue</th>
                  <th style={{ width: 110 }}>Validator</th>
                  <th style={{ width: 175 }}>Found</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onOpenRun(issue.runId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenRun(issue.runId);
                      }
                    }}
                  >
                    <td>
                      <span className={`chip issue-sev--${issue.severity}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td>{issue.title}</td>
                    <td className="cell-muted">{issue.validator}</td>
                    <td className="cell-muted">{formatDate(issue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
