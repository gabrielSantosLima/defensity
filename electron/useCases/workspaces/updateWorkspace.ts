import type {
  LibraryArtifactKind,
  ProviderId,
  ThinkingLevel,
  Workspace,
  WorkspaceInput,
} from "../../../shared/types";
import {
  assertWorkspaceInput,
  planArtifacts,
} from "../../entities/workspace";
import type { Clock, Ids } from "../../services/clock";
import type { FileService } from "../../services/fileService";
import type { WorkspaceService } from "../../services/workspaceService";

interface Deps {
  workspaces: WorkspaceService;
  files: FileService;
  clock: Clock;
  ids: Ids;
}

export class UpdateWorkspaceUseCase {
  private readonly workspaces: WorkspaceService;
  private readonly files: FileService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({ workspaces, files, clock, ids }: Deps) {
    this.workspaces = workspaces;
    this.files = files;
    this.clock = clock;
    this.ids = ids;
  }

  async execute(id: string, input: WorkspaceInput): Promise<Workspace> {
    const current = this.workspaces.get(id);
    if (!current) {
      throw new Error("Workspace not found");
    }
    assertWorkspaceInput(input);

    const updatedAt = this.clock.now();
    const planned = planArtifacts(input);
    const artifacts = [];

    for (const item of planned) {
      const print = await this.files.fingerprint(item.path);
      artifacts.push({
        id: this.ids.newId(),
        workspaceId: id,
        kind: item.kind,
        path: item.path,
        hash: print.hash,
        size: print.size,
        createdAt: updatedAt,
      });
    }

    const workspace: Workspace = {
      ...current,
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
      authorizationNote: input.authorizationNote?.trim() || null,
      updatedAt,
      artifacts,
    };

    this.workspaces.update(workspace);
    return workspace;
  }
}
