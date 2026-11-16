import type { ArchiveWorkspaceUseCase } from "../useCases/workspaces/archiveWorkspace";
import type { CreateWorkspaceUseCase } from "../useCases/workspaces/createWorkspace";
import type { GetWorkspaceUseCase } from "../useCases/workspaces/getWorkspace";
import type { ListWorkspacesUseCase } from "../useCases/workspaces/listWorkspaces";
import type { GetSettingsUseCase } from "../useCases/settings/getSettings";
import type { SaveEngineSettingsUseCase } from "../useCases/settings/saveEngineSettings";
import type { ClearProviderKeyUseCase } from "../useCases/providers/clearProviderKey";
import type { ListModelsUseCase } from "../useCases/providers/listModels";
import type { SetProviderKeyUseCase } from "../useCases/providers/setProviderKey";
import type { CancelRunUseCase } from "../useCases/runs/cancelRun";
import type { GetRunUseCase } from "../useCases/runs/getRun";
import type { GenerateReportUseCase } from "../useCases/runs/generateReport";
import type { ListFindingsUseCase } from "../useCases/runs/listFindings";
import type { ListWorkspaceIssuesUseCase } from "../useCases/runs/listWorkspaceIssues";
import type { ListHypothesesUseCase } from "../useCases/runs/listHypotheses";
import type { ListRunEventsUseCase } from "../useCases/runs/listRunEvents";
import type { ListRunsUseCase } from "../useCases/runs/listRuns";
import type { StartRunUseCase } from "../useCases/runs/startRun";

export interface AppUseCases {
  listWorkspaces: ListWorkspacesUseCase;
  getWorkspace: GetWorkspaceUseCase;
  createWorkspace: CreateWorkspaceUseCase;
  archiveWorkspace: ArchiveWorkspaceUseCase;
  getSettings: GetSettingsUseCase;
  saveSettings: SaveEngineSettingsUseCase;
  setProviderKey: SetProviderKeyUseCase;
  clearProviderKey: ClearProviderKeyUseCase;
  listModels: ListModelsUseCase;
  startRun: StartRunUseCase;
  cancelRun: CancelRunUseCase;
  getRun: GetRunUseCase;
  listRuns: ListRunsUseCase;
  listRunEvents: ListRunEventsUseCase;
  listHypotheses: ListHypothesesUseCase;
  listFindings: ListFindingsUseCase;
  listWorkspaceIssues: ListWorkspaceIssuesUseCase;
  generateReport: GenerateReportUseCase;
}
