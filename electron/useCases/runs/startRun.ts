import type { Run } from "../../../shared/types";
import { baseUrlFor } from "../../entities/provider";
import { createRunRecord, isRunActive } from "../../entities/run";
import type { AgentService } from "../../services/agentService";
import type { Clock, Ids } from "../../services/clock";
import type { RunService } from "../../services/runService";
import type { SecretService } from "../../services/secretService";
import type { SettingsService } from "../../services/settingsService";
import type { WorkspaceService } from "../../services/workspaceService";

interface Deps {
  workspaces: WorkspaceService;
  runs: RunService;
  secrets: SecretService;
  settings: SettingsService;
  agent: AgentService;
  clock: Clock;
  ids: Ids;
}

export class StartRunUseCase {
  private readonly workspaces: WorkspaceService;
  private readonly runs: RunService;
  private readonly secrets: SecretService;
  private readonly settings: SettingsService;
  private readonly agent: AgentService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({ workspaces, runs, secrets, settings, agent, clock, ids }: Deps) {
    this.workspaces = workspaces;
    this.runs = runs;
    this.secrets = secrets;
    this.settings = settings;
    this.agent = agent;
    this.clock = clock;
    this.ids = ids;
  }

  execute(workspaceId: string): Run {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    if (!workspace.provider || !workspace.model) {
      throw new Error("Choose a provider and a model before running");
    }

    const apiKey = this.secrets.read(workspace.provider);
    if (!apiKey) {
      throw new Error("Add an API key for this provider in Settings");
    }

    const active = this.runs
      .listByWorkspace(workspaceId)
      .find((run) => isRunActive(run.status));
    if (active) {
      throw new Error("A run is already active for this workspace");
    }

    const baseUrl = baseUrlFor(
      workspace.provider,
      this.settings.get().compatibleBaseUrl,
    );
    if (!baseUrl) {
      throw new Error("Set the base URL for the OpenAI-compatible provider");
    }

    const run = createRunRecord({
      id: this.ids.newId(),
      workspaceId: workspace.id,
      provider: workspace.provider,
      model: workspace.model,
      thinking: workspace.thinking,
      createdAt: this.clock.now(),
    });

    this.runs.create(run);
    this.agent.start({
      run,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        targetUrl: workspace.targetUrl,
        targetApkPath: workspace.targetApkPath,
        libraryArtifactPath: workspace.libraryArtifactPath,
        sourcePath: workspace.sourcePath,
        docsPath: workspace.docsPath,
      },
      apiKey,
      baseUrl,
      limits: { maxSteps: 8, maxToolResultChars: 12000 },
    });

    return run;
  }
}
