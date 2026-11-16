import type { Workspace } from "../../shared/types";
import { Button } from "../components/Button";
import { EmptyState, Panel } from "../components/ui";
import { Spinner } from "../components/Spinner";
import { formatDate } from "../lib/format";

const TYPE_LABEL: Record<Workspace["type"], string> = {
  web: "Web",
  android: "Android",
  library: "Library",
};

function targetLabel(workspace: Workspace): string {
  if (workspace.type === "web") {
    return workspace.targetUrl ?? "—";
  }
  if (workspace.type === "android") {
    return workspace.targetApkPath?.split(/[\\/]/).pop() ?? "—";
  }
  return workspace.libraryArtifactPath?.split(/[\\/]/).pop() ?? "—";
}

interface WorkspacesPageProps {
  workspaces: Workspace[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (workspace: Workspace) => void;
}

export function WorkspacesPage({
  workspaces,
  loading,
  onCreate,
  onOpen,
}: WorkspacesPageProps) {
  return (
    <div className="page">
      <p className="hint">
        Each workspace is a project you own or are authorized to test. Files are
        hashed on import and frozen per analysis run.
      </p>

      <Panel
        title="Registered workspaces"
        meta={`${workspaces.length} active`}
        flush
      >
        {loading ? (
          <div className="panel-body loading-inline">
            <Spinner />
            Loading workspaces…
          </div>
        ) : workspaces.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title="No workspaces yet"
              description="Create a workspace to register a target, its artifacts and the authorization for analysis."
              action={
                <Button variant="secondary" onClick={onCreate}>
                  Create workspace
                </Button>
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th>Target</th>
                  <th style={{ width: 90 }}>Artifacts</th>
                  <th style={{ width: 185 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onOpen(workspace)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(workspace);
                      }
                    }}
                  >
                    <td>
                      <strong style={{ fontWeight: 600 }}>{workspace.name}</strong>
                    </td>
                    <td>
                      <span className="chip">{TYPE_LABEL[workspace.type]}</span>
                    </td>
                    <td className="cell-mono">
                      {workspace.type === "web" && workspace.targetUrl ? (
                        <a
                          className="link"
                          href={workspace.targetUrl}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void window.defensity.openExternal(
                              workspace.targetUrl as string,
                            );
                          }}
                        >
                          {workspace.targetUrl}
                        </a>
                      ) : (
                        targetLabel(workspace)
                      )}
                    </td>
                    <td className="cell-mono">{workspace.artifacts.length}</td>
                    <td className="cell-muted">
                      {formatDate(workspace.updatedAt)}
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
