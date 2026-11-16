import type { Workspace } from "../../../shared/types";
import type { WorkspaceService } from "../../services/workspaceService";

export class ListWorkspacesUseCase {
  constructor(private readonly workspaces: WorkspaceService) {}

  execute(): Workspace[] {
    return this.workspaces.list();
  }
}
