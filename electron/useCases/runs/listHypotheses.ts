import type { Hypothesis } from "../../../shared/types";
import type { HypothesisService } from "../../services/hypothesisService";

export class ListHypothesesUseCase {
  constructor(private readonly hypotheses: HypothesisService) {}

  execute(runId: string): Hypothesis[] {
    return this.hypotheses.listByRun(runId);
  }
}
