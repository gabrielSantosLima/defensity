import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Settings as SettingsIcon,
} from "lucide-react";
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
  | { name: "edit"; id: string; title: string }
  | {
      name: "run";
      id: string;
      workspaceId: string;
      workspaceName: string;
    }
  | { name: "settings" };

export function App() {
  const [history, setHistory] = useState<View[]>([{ name: "workspaces" }]);
  const [index, setIndex] = useState(0);
  const view = history[index];

  const navigate = useCallback(
    (next: View) => {
      setHistory((current) => [...current.slice(0, index + 1), next]);
      setIndex(index + 1);
    },
    [index],
  );

  const move = useCallback(
    (delta: number) => {
      setIndex((current) =>
        Math.min(Math.max(current + delta, 0), history.length - 1),
      );
    },
    [history.length],
  );
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const inWorkspaceSection =
    view.name === "workspaces" ||
    view.name === "new" ||
    view.name === "workspace" ||
    view.name === "edit" ||
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
            : view.name === "edit"
              ? "Edit workspace"
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
              onClick={() => navigate({ name: "workspaces" })}
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
              onClick={() => navigate({ name: "settings" })}
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
            <div className="nav-arrows">
              <button
                type="button"
                className="icon-btn"
                aria-label="Back"
                disabled={index === 0}
                onClick={() => move(-1)}
              >
                <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Forward"
                disabled={index >= history.length - 1}
                onClick={() => move(1)}
              >
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <h1>{title}</h1>
            <div className="spacer" />
            {view.name === "workspaces" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate({ name: "new" })}
              >
                New workspace
              </Button>
            ) : null}
            {view.name === "new" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ name: "workspaces" })}
              >
                Cancel
              </Button>
            ) : null}
            {view.name === "workspace" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ name: "workspaces" })}
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
                onCreate={() => navigate({ name: "new" })}
                onOpen={(workspace) =>
                  navigate({
                    name: "workspace",
                    id: workspace.id,
                    title: workspace.name,
                  })
                }
              />
            ) : null}

            {view.name === "new" ? (
              <WorkspaceForm
                onCancel={() => navigate({ name: "workspaces" })}
                onCreated={(workspace) => {
                  void refresh();
                  navigate({
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
                onBack={() => navigate({ name: "workspaces" })}
                onArchived={() => {
                  void refresh();
                  navigate({ name: "workspaces" });
                }}
                onRun={(run: Run) =>
                  navigate({
                    name: "run",
                    id: run.id,
                    workspaceId: run.workspaceId,
                    workspaceName: view.title,
                  })
                }
                onOpenRun={(runId: string) =>
                  navigate({
                    name: "run",
                    id: runId,
                    workspaceId: view.id,
                    workspaceName: view.title,
                  })
                }
                onEdit={() =>
                  navigate({ name: "edit", id: view.id, title: view.title })
                }
              />
            ) : null}

            {view.name === "run" ? (
              <RunConsole
                runId={view.id}
                workspaceName={view.workspaceName}
                onBack={() =>
                  navigate({
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
