import { isRunActive } from "../../entities/run";
import type { AgentService } from "../../services/agentService";
import type { RunService } from "../../services/runService";

interface Deps {
  runs: RunService;
  agent: AgentService;
}

export class CancelRunUseCase {
  private readonly runs: RunService;
  private readonly agent: AgentService;

  constructor({ runs, agent }: Deps) {
    this.runs = runs;
    this.agent = agent;
  }

  execute(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    if (!isRunActive(run.status)) {
      return;
    }
    this.agent.cancel(runId);
  }
}
