import type { Workspace } from "../../../shared/types";
import type { WorkspaceService } from "../../services/workspaceService";

export class GetWorkspaceUseCase {
  constructor(private readonly workspaces: WorkspaceService) {}

  execute(id: string): Workspace | null {
    return this.workspaces.get(id);
  }
}
