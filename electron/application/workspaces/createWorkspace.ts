import type {
  LibraryArtifactKind,
  ProviderId,
  ThinkingLevel,
  Workspace,
  WorkspaceInput,
} from "../../../shared/types";
import { assertWorkspaceInput, planArtifacts } from "../../domain/entities/artifacts";
import type { Fingerprint } from "../../domain/ports/fingerprint";
import type { WorkspaceRepository } from "../../domain/ports/workspaceRepository";

export interface CreateWorkspaceDeps {
  repository: WorkspaceRepository;
  fingerprint: Fingerprint;
  now: () => string;
  newId: () => string;
}

export async function createWorkspace(
  input: WorkspaceInput,
  deps: CreateWorkspaceDeps,
): Promise<Workspace> {
  assertWorkspaceInput(input);

  const createdAt = deps.now();
  const id = deps.newId();
  const planned = planArtifacts(input);
  const artifacts = [];

  for (const item of planned) {
    const print = await deps.fingerprint(item.path);
    artifacts.push({
      id: deps.newId(),
      workspaceId: id,
      kind: item.kind,
      path: item.path,
      hash: print.hash,
      size: print.size,
      createdAt,
    });
  }

  const workspace: Workspace = {
    id,
    name: input.name.trim(),
    type: input.type,
    targetUrl: input.targetUrl?.trim() || null,
    targetApkPath: input.targetApkPath || null,
    libraryArtifactPath: input.libraryArtifactPath || null,
    libraryArtifactKind:
      (input.libraryArtifactKind as LibraryArtifactKind | null) ?? null,
    sourcePath: input.sourcePath || null,
    docsPath: input.docsPath || null,
    provider: (input.provider as ProviderId | null) ?? null,
    model: input.model?.trim() || null,
    thinking: (input.thinking as ThinkingLevel | null) ?? null,
    authorizedAt: createdAt,
    authorizationNote: input.authorizationNote?.trim() || null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    artifacts,
  };

  deps.repository.insert(workspace);
  return workspace;
}
