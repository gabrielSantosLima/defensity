import type { Finding } from "../../../shared/types";
import type { FindingService } from "../../services/findingService";

export class ListFindingsUseCase {
  constructor(private readonly findings: FindingService) {}

  execute(runId: string): Finding[] {
    return this.findings.listByRun(runId);
  }
}
