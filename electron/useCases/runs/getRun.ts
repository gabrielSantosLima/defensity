import type { Run } from "../../../shared/types";
import type { RunService } from "../../services/runService";

export class GetRunUseCase {
  constructor(private readonly runs: RunService) {}

  execute(runId: string): Run | null {
    return this.runs.get(runId);
  }
}
