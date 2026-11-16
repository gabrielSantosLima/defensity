import type {
  RunEvent,
  RunEventType,
} from "../../../shared/types";
import type { Clock, Ids } from "../../services/clock";
import type { RunService } from "../../services/runService";

interface Deps {
  runs: RunService;
  clock: Clock;
  ids: Ids;
}

export class RecordRunEventUseCase {
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
    type: RunEventType;
    payload: Record<string, unknown>;
  }): RunEvent {
    if (input.type === "usage") {
      this.runs.addUsage(input.runId, {
        promptTokens: Number(input.payload.promptTokens ?? 0),
        completionTokens: Number(input.payload.completionTokens ?? 0),
        totalTokens: Number(input.payload.totalTokens ?? 0),
      });
    }
    if (input.type === "step.started") {
      this.runs.setStepCount(input.runId, Number(input.payload.step ?? 0));
    }

    const createdAt = this.clock.now();
    const id = this.ids.newId();
    const seq = this.runs.appendEvent({
      id,
      runId: input.runId,
      type: input.type,
      payload: input.payload,
      createdAt,
    });

    return {
      id,
      runId: input.runId,
      seq,
      type: input.type,
      payload: input.payload,
      createdAt,
    };
  }
}
