import type { WorkspaceService } from "../../services/workspaceService";

export class DeleteWorkspaceUseCase {
  constructor(private readonly workspaces: WorkspaceService) {}

  execute(id: string): void {
    if (!this.workspaces.get(id)) {
      throw new Error("Workspace not found");
    }
    this.workspaces.delete(id);
  }
}
