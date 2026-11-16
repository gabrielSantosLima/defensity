import type { RunService } from "../../services/runService";

export class ClearRunHistoryUseCase {
  constructor(private readonly runs: RunService) {}

  execute(workspaceId: string): void {
    this.runs.deleteByWorkspace(workspaceId);
  }
}
