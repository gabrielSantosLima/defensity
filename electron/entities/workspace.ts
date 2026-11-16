import type {
  ArtifactKind,
  WorkspaceInput,
} from "../../../shared/types";

export interface PlannedArtifact {
  kind: ArtifactKind;
  path: string;
}

/**
 * Maps a workspace definition to the artifacts that must be hashed on import.
 * The target itself is an artifact: a URL, an APK or a lockfile/SBOM.
 */
export function planArtifacts(input: WorkspaceInput): PlannedArtifact[] {
  const planned: PlannedArtifact[] = [];

  if (input.type === "web" && input.targetUrl) {
    planned.push({ kind: "url", path: input.targetUrl });
  }
  if (input.type === "android" && input.targetApkPath) {
    planned.push({ kind: "apk", path: input.targetApkPath });
  }
  if (
    input.type === "library" &&
    input.libraryArtifactPath &&
    input.libraryArtifactKind
  ) {
    planned.push({
      kind: input.libraryArtifactKind,
      path: input.libraryArtifactPath,
    });
  }
  if (input.sourcePath) {
    planned.push({ kind: "source", path: input.sourcePath });
  }
  if (input.docsPath) {
    planned.push({ kind: "docs", path: input.docsPath });
  }

  return planned;
}

export function assertWorkspaceInput(input: WorkspaceInput): void {
  if (!input.name.trim()) {
    throw new Error("Workspace name is required");
  }
  if (input.type === "web" && !input.targetUrl?.trim()) {
    throw new Error("A web workspace needs a URL");
  }
  if (input.type === "android" && !input.targetApkPath) {
    throw new Error("An Android workspace needs an APK");
  }
  if (
    input.type === "library" &&
    (!input.libraryArtifactPath || !input.libraryArtifactKind)
  ) {
    throw new Error("A library workspace needs an artifact and its format");
  }
}
