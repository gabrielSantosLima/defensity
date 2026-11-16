import type { RunEvent } from "../../../shared/types";
import type { RunService } from "../../services/runService";

export class ListRunEventsUseCase {
  constructor(private readonly runs: RunService) {}

  execute(runId: string): RunEvent[] {
    return this.runs.listEvents(runId);
  }
}
