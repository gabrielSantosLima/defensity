import { useEffect, useState } from "react";
import type { Workspace } from "../../shared/types";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { errorMessage } from "../lib/format";
import { WorkspaceForm } from "./WorkspaceForm";

interface EditWorkspacePageProps {
  id: string;
  onCancel: () => void;
  onSaved: (workspace: Workspace) => void;
}

export function EditWorkspacePage({
  id,
  onCancel,
  onSaved,
}: EditWorkspacePageProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.defensity
      .getWorkspace(id)
      .then((found) => {
        if (!active) {
          return;
        }
        if (found) {
          setWorkspace(found);
        } else {
          setError("This workspace no longer exists.");
        }
      })
      .catch((caught) => {
        if (active) {
          setError(errorMessage(caught));
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="alert">{error}</div>
        <div>
          <Button variant="secondary" onClick={onCancel}>
            Back to workspace
          </Button>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="page">
        <div className="panel-body loading-inline">
          <Spinner />
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <WorkspaceForm
      workspace={workspace}
      onCancel={onCancel}
      onCreated={onSaved}
    />
  );
}
