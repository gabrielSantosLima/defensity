import type { RunEvent, RunEventType, RunStatus } from "../../../shared/types";
import type { Clock, Ids } from "../../services/clock";
import type { RunService } from "../../services/runService";

interface Deps {
  runs: RunService;
  clock: Clock;
  ids: Ids;
}

export class FinishRunUseCase {
  private readonly runs: RunService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({ runs, clock, ids }: Deps) {
    this.runs = runs;
    this.clock = clock;
    this.ids = ids;
  }

  execute(input: {
    runId: string;
    status: Extract<RunStatus, "completed" | "failed" | "cancelled">;
    error?: string;
    steps?: number;
  }): RunEvent {
    const endedAt = this.clock.now();
    if (typeof input.steps === "number") {
      this.runs.setStepCount(input.runId, input.steps);
    }
    this.runs.setStatus(input.runId, input.status, {
      endedAt,
      error: input.error,
    });

    const type: RunEventType =
      input.status === "completed"
        ? "run.completed"
        : input.status === "cancelled"
          ? "run.cancelled"
          : "run.failed";
    const payload = input.error ? { error: input.error } : {};

    const createdAt = this.clock.now();
    const id = this.ids.newId();
    const seq = this.runs.appendEvent({
      id,
      runId: input.runId,
      type,
      payload,
      createdAt,
    });

    return { id, runId: input.runId, seq, type, payload, createdAt };
  }
}
