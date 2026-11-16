import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Settings as SettingsIcon } from "lucide-react";
import logo from "../assets/logo/logo-dark.svg";
import version from "../package.json";
import type { Run, Workspace } from "../shared/types";
import { Button } from "./components/Button";
import { errorMessage } from "./lib/format";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkspaceDetail } from "./pages/WorkspaceDetail";
import { WorkspaceForm } from "./pages/WorkspaceForm";
import { RunConsole } from "./pages/RunConsole";
import { WorkspacesPage } from "./pages/WorkspacesPage";

type View =
  | { name: "workspaces" }
  | { name: "new" }
  | { name: "workspace"; id: string; title: string }
  | {
      name: "run";
      id: string;
      workspaceId: string;
      workspaceName: string;
    }
  | { name: "settings" };

export function App() {
  const [view, setView] = useState<View>({ name: "workspaces" });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await window.defensity.listWorkspaces();
      setWorkspaces(list);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inWorkspaceSection =
    view.name === "workspaces" ||
    view.name === "new" ||
    view.name === "workspace" ||
    view.name === "run";

  const title =
    view.name === "workspaces"
      ? "Workspaces"
      : view.name === "new"
        ? "New workspace"
        : view.name === "settings"
          ? "Settings"
          : view.name === "run"
            ? "Run"
            : view.title;

  return (
    <div className="app-shell">
      <div className="app-body">
        <aside className="sidebar">
          <div className="brand">
            <img src={logo} alt="defensity" />
            <span>local</span>
          </div>

          <nav className="nav" aria-label="Primary">
            <span className="nav-label">Workspace</span>
            <button
              type="button"
              aria-current={inWorkspaceSection ? "page" : undefined}
              onClick={() => setView({ name: "workspaces" })}
            >
              <LayoutGrid size={15} strokeWidth={1.5} aria-hidden="true" />
              Workspaces
              <span className="count">{workspaces.length}</span>
            </button>

            <span className="nav-label" style={{ marginTop: 12 }}>
              System
            </span>
            <button
              type="button"
              aria-current={view.name === "settings" ? "page" : undefined}
              onClick={() => setView({ name: "settings" })}
            >
              <SettingsIcon size={15} strokeWidth={1.5} aria-hidden="true" />
              Settings
            </button>
          </nav>

          <div className="sidebar-foot">
            defensity v{version.version}
            <br />
            local database
          </div>
        </aside>

        <main className="main">
          <header className="appbar">
            <h1>{title}</h1>
            <div className="spacer" />
            {view.name === "workspaces" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setView({ name: "new" })}
              >
                New workspace
              </Button>
            ) : null}
            {view.name === "new" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView({ name: "workspaces" })}
              >
                Cancel
              </Button>
            ) : null}
            {view.name === "workspace" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView({ name: "workspaces" })}
              >
                All workspaces
              </Button>
            ) : null}
          </header>

          <div className="content">
            {error ? (
              <div className="alert" style={{ marginBottom: 14 }}>
                {error}
              </div>
            ) : null}

            {view.name === "workspaces" ? (
              <WorkspacesPage
                workspaces={workspaces}
                loading={loading}
                onCreate={() => setView({ name: "new" })}
                onOpen={(workspace) =>
                  setView({
                    name: "workspace",
                    id: workspace.id,
                    title: workspace.name,
                  })
                }
              />
            ) : null}

            {view.name === "new" ? (
              <WorkspaceForm
                onCancel={() => setView({ name: "workspaces" })}
                onCreated={(workspace) => {
                  void refresh();
                  setView({
                    name: "workspace",
                    id: workspace.id,
                    title: workspace.name,
                  });
                }}
              />
            ) : null}

            {view.name === "workspace" ? (
              <WorkspaceDetail
                id={view.id}
                onBack={() => setView({ name: "workspaces" })}
                onArchived={() => {
                  void refresh();
                  setView({ name: "workspaces" });
                }}
                onRun={(run: Run) =>
                  setView({
                    name: "run",
                    id: run.id,
                    workspaceId: run.workspaceId,
                    workspaceName: view.title,
                  })
                }
              />
            ) : null}

            {view.name === "run" ? (
              <RunConsole
                runId={view.id}
                onBack={() =>
                  setView({
                    name: "workspace",
                    id: view.workspaceId,
                    title: view.workspaceName,
                  })
                }
              />
            ) : null}

            {view.name === "settings" ? <SettingsPage /> : null}
          </div>
        </main>
      </div>

      <footer className="statusbar">
        <span className="live" aria-hidden="true" />
        <span>local database</span>
        <span className="spacer" />
        <span>
          {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
        </span>
        <span>v{version.version}</span>
      </footer>
    </div>
  );
}
