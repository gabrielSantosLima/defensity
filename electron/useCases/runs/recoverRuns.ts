import type { Clock, Ids } from "../../services/clock";
import type { RunService } from "../../services/runService";

interface Deps {
  runs: RunService;
  clock: Clock;
  ids: Ids;
}

/**
 * A run cannot survive the app process: its agent died with it. On startup any
 * run still marked active is closed as failed so the UI never shows a ghost.
 */
export class RecoverRunsUseCase {
  private readonly runs: RunService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({ runs, clock, ids }: Deps) {
    this.runs = runs;
    this.clock = clock;
    this.ids = ids;
  }

  execute(): number {
    const active = this.runs.listActive();
    for (const run of active) {
      const endedAt = this.clock.now();
      this.runs.setStatus(run.id, "failed", {
        endedAt,
        error: "Interrupted by app restart",
      });
      this.runs.appendEvent({
        id: this.ids.newId(),
        runId: run.id,
        type: "run.failed",
        payload: { error: "Interrupted by app restart" },
        createdAt: endedAt,
      });
    }
    return active.length;
  }
}
