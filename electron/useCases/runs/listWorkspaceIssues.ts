import type { Finding } from "../../../shared/types";
import type { FindingService } from "../../services/findingService";

export class ListWorkspaceIssuesUseCase {
  constructor(private readonly findings: FindingService) {}

  execute(workspaceId: string): Finding[] {
    return this.findings.listByWorkspace(workspaceId);
  }
}
