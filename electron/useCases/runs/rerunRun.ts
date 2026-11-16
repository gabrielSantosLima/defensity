import type { Run } from "../../../shared/types";
import type { RunService } from "../../services/runService";
import type { StartRunUseCase } from "./startRun";

interface Deps {
  runs: RunService;
  startRun: StartRunUseCase;
}

export class RerunRunUseCase {
  private readonly runs: RunService;
  private readonly startRun: StartRunUseCase;

  constructor({ runs, startRun }: Deps) {
    this.runs = runs;
    this.startRun = startRun;
  }

  execute(runId: string): Run {
    const previous = this.runs.get(runId);
    if (!previous) {
      throw new Error("Run not found");
    }
    return this.startRun.execute(previous.workspaceId, { rerunOf: runId });
  }
}
