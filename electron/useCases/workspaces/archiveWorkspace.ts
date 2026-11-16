import type { Clock } from "../../services/clock";
import type { WorkspaceService } from "../../services/workspaceService";

interface Deps {
  workspaces: WorkspaceService;
  clock: Clock;
}

export class ArchiveWorkspaceUseCase {
  private readonly workspaces: WorkspaceService;
  private readonly clock: Clock;

  constructor({ workspaces, clock }: Deps) {
    this.workspaces = workspaces;
    this.clock = clock;
  }

  execute(id: string): void {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    if (workspace.archivedAt) {
      return;
    }
    this.workspaces.archive(id, this.clock.now());
  }
}
