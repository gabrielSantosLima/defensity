import type { Run } from "../../../shared/types";
import type { RunService } from "../../services/runService";

export class ListRunsUseCase {
  constructor(private readonly runs: RunService) {}

  execute(workspaceId: string): Run[] {
    return this.runs.listByWorkspace(workspaceId);
  }
}
