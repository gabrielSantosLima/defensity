import { useState } from "react";
import type {
  LibraryArtifactKind,
  ProviderId,
  ThinkingLevel,
  Workspace,
  WorkspaceType,
} from "../../shared/types";
import { ModelPicker } from "../components/ModelPicker";
import { Button } from "../components/Button";
import { PathField } from "../components/PathField";
import { Field, Panel } from "../components/ui";
import { errorMessage } from "../lib/format";

const TYPES: Array<{ id: WorkspaceType; label: string }> = [
  { id: "web", label: "Web" },
  { id: "android", label: "Android" },
  { id: "library", label: "Library" },
];

interface WorkspaceFormProps {
  workspace?: Workspace;
  onCancel: () => void;
  onCreated: (workspace: Workspace) => void;
}

export function WorkspaceForm({
  workspace,
  onCancel,
  onCreated,
}: WorkspaceFormProps) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [type, setType] = useState<WorkspaceType>(workspace?.type ?? "web");
  const [targetUrl, setTargetUrl] = useState(workspace?.targetUrl ?? "");
  const [apkPath, setApkPath] = useState(workspace?.targetApkPath ?? "");
  const [libraryPath, setLibraryPath] = useState(workspace?.libraryArtifactPath ?? "");
  const [libraryKind, setLibraryKind] = useState<LibraryArtifactKind>(
    workspace?.libraryArtifactKind ?? "lockfile",
  );
  const [sourcePath, setSourcePath] = useState(workspace?.sourcePath ?? "");
  const [docsPath, setDocsPath] = useState(workspace?.docsPath ?? "");
  const [provider, setProvider] = useState<ProviderId | "">(
    workspace?.provider ?? "",
  );
  const [model, setModel] = useState(workspace?.model ?? "");
  const [thinking, setThinking] = useState<ThinkingLevel>(
    workspace?.thinking ?? "off",
  );
  const [authorized, setAuthorized] = useState(Boolean(workspace));
  const [note, setNote] = useState(workspace?.authorizationNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate(): string | null {
    if (!name.trim()) {
      return "Give the workspace a name.";
    }
    if (type === "web") {
      if (!targetUrl.trim()) {
        return "A web workspace needs a URL.";
      }
      if (!/^https?:\/\//i.test(targetUrl.trim())) {
        return "The URL must start with http:// or https://.";
      }
    }
    if (type === "android" && !apkPath) {
      return "Select the APK to analyze.";
    }
    if (type === "library" && !libraryPath) {
      return "Select the lockfile or SBOM to analyze.";
    }
    if (!authorized) {
      return "Confirm that you own or are authorized to test this target.";
    }
    return null;
  }

  const workspaceObject = workspace;

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        type,
        targetUrl: type === "web" ? targetUrl.trim() : null,
        targetApkPath: type === "android" ? apkPath : null,
        libraryArtifactPath: type === "library" ? libraryPath : null,
        libraryArtifactKind: type === "library" ? libraryKind : null,
        sourcePath: sourcePath || null,
        docsPath: docsPath || null,
        provider: provider || null,
        model: model.trim() || null,
        thinking,
        authorizationNote: note.trim() || null,
      };
      const saved = workspaceObject
        ? await window.defensity.updateWorkspace(workspaceObject.id, input)
        : await window.defensity.createWorkspace(input);
      onCreated(saved);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <form
        className="form panel"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-section">
          <div className="form-row">
            <Field label="Name" htmlFor="workspace-name">
              <input
                id="workspace-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="payments-api"
                autoFocus
              />
            </Field>
            <Field label="Type">
              <div className="seg" role="group" aria-label="Workspace type">
                {TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={type === item.id}
                    onClick={() => setType(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {type === "web" ? (
            <Field
              label="URL"
              htmlFor="workspace-url"
              hint="Hosts outside this URL are out of scope."
            >
              <input
                id="workspace-url"
                className="input"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                placeholder="https://payments.example.com"
              />
            </Field>
          ) : null}

          {type === "android" ? (
            <PathField
              id="workspace-apk"
              label="APK"
              mode="file"
              value={apkPath}
              placeholder="Select an .apk file"
              onChange={setApkPath}
            />
          ) : null}

          {type === "library" ? (
            <div className="form-row">
              <PathField
                id="workspace-library"
                label="Library artifact"
                mode="file"
                value={libraryPath}
                placeholder="package-lock.json, poetry.lock, bom.json"
                onChange={setLibraryPath}
              />
              <Field label="Artifact format" htmlFor="workspace-library-kind">
                <select
                  id="workspace-library-kind"
                  className="select"
                  value={libraryKind}
                  onChange={(event) =>
                    setLibraryKind(event.target.value as LibraryArtifactKind)
                  }
                >
                  <option value="lockfile">Lockfile</option>
                  <option value="sbom">SBOM</option>
                  <option value="tarball" disabled>
                    Tarball — later
                  </option>
                </select>
              </Field>
            </div>
          ) : null}
        </div>

        <div className="form-section">
          <PathField
            id="workspace-source"
            label="Source code (optional)"
            mode="directory"
            value={sourcePath}
            placeholder="Select the project directory"
            hint="Enables white-box analysis. Without it the run is black-box."
            onChange={setSourcePath}
          />
          <PathField
            id="workspace-docs"
            label="Documentation (optional)"
            mode="directory"
            value={docsPath}
            placeholder="Select the documentation directory"
            hint="Specs, README, OpenAPI. Used as context, never executed."
            onChange={setDocsPath}
          />
        </div>

        <div className="form-section">
          <Field
            label="Model"
            hint="Only models from connected providers are listed. There is no default model."
          >
            <ModelPicker
              value={{
                provider: provider || null,
                model: model || null,
                thinking,
              }}
              onChange={(next) => {
                setProvider(next.provider ?? "");
                setModel(next.model ?? "");
                setThinking(next.thinking ?? "off");
              }}
            />
          </Field>
        </div>

        <div className="form-section">
          <Field
            label="Authorization"
            hint="Recorded with the workspace and frozen into every run."
          >
            <label className="check">
              <input
                type="checkbox"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              I own this target or have explicit permission to test it.
            </label>
          </Field>
          <Field label="Authorization note" htmlFor="workspace-note">
            <input
              id="workspace-note"
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ticket, owner or contract reference"
            />
          </Field>
        </div>

        {error ? (
          <div className="form-section" style={{ paddingTop: 0 }}>
            <div className="alert">{error}</div>
          </div>
        ) : null}

        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            {workspaceObject ? "Save changes" : "Create workspace"}
          </Button>
        </div>
      </form>
    </div>
  );
}
