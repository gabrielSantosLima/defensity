import type { Run } from "../../../shared/types";
import { baseUrlFor } from "../../entities/provider";
import { createRunRecord, isRunActive } from "../../entities/run";
import type { AgentService } from "../../services/agentService";
import type { Clock, Ids } from "../../services/clock";
import type { FindingService } from "../../services/findingService";
import type { HypothesisService } from "../../services/hypothesisService";
import type { RunService } from "../../services/runService";
import type { SandboxService } from "../../services/sandboxService";
import type { SecretService } from "../../services/secretService";
import type { SettingsService } from "../../services/settingsService";
import type { WorkspaceService } from "../../services/workspaceService";

interface Deps {
  workspaces: WorkspaceService;
  runs: RunService;
  secrets: SecretService;
  settings: SettingsService;
  agent: AgentService;
  sandbox: SandboxService;
  hypotheses: HypothesisService;
  findings: FindingService;
  clock: Clock;
  ids: Ids;
}

export class StartRunUseCase {
  private readonly workspaces: WorkspaceService;
  private readonly runs: RunService;
  private readonly secrets: SecretService;
  private readonly settings: SettingsService;
  private readonly agent: AgentService;
  private readonly sandbox: SandboxService;
  private readonly hypotheses: HypothesisService;
  private readonly findings: FindingService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({
    workspaces,
    runs,
    secrets,
    settings,
    agent,
    sandbox,
    hypotheses,
    findings,
    clock,
    ids,
  }: Deps) {
    this.workspaces = workspaces;
    this.runs = runs;
    this.secrets = secrets;
    this.settings = settings;
    this.agent = agent;
    this.sandbox = sandbox;
    this.hypotheses = hypotheses;
    this.findings = findings;
    this.clock = clock;
    this.ids = ids;
  }

  execute(workspaceId: string, options?: { rerunOf?: string }): Run {
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

    this.sandbox.preflight();

    const baseUrl = baseUrlFor(
      workspace.provider,
      this.settings.get().compatibleBaseUrl,
    );
    if (!baseUrl) {
      throw new Error("Set the base URL for the OpenAI-compatible provider");
    }

    let seed: string | undefined;
    if (options?.rerunOf) {
      const previous = this.runs.get(options.rerunOf);
      if (!previous || previous.workspaceId !== workspaceId) {
        throw new Error("Previous run not found for this workspace");
      }
      seed = this.buildSeed(previous);
    }

    const run = createRunRecord({
      id: this.ids.newId(),
      workspaceId: workspace.id,
      provider: workspace.provider,
      model: workspace.model,
      thinking: workspace.thinking,
      createdAt: this.clock.now(),
      rerunOf: options?.rerunOf ?? null,
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
      seed,
      allowInvalidCertificates:
        this.settings.get().allowInvalidCertificates,
      limits: {
        maxToolResultChars: 12000,
        budget: this.settings.get().compactionBudget,
        maxTokens: this.settings.get().runTokenBudget,
      },
    });

    return run;
  }

  private buildSeed(previous: Run): string {
    const events = this.runs.listEvents(previous.id);
    const hypotheses = this.hypotheses.listByRun(previous.id);
    const findings = this.findings.listByRun(previous.id);
    const lines = [
      `Previous run ${previous.id} ended as ${previous.status} after ${previous.stepCount} steps and ${previous.totalTokens} tokens.`,
    ];

    if (hypotheses.length > 0) {
      lines.push("Hypotheses recorded:");
      for (const hypothesis of hypotheses.slice(0, 12)) {
        lines.push(
          `- [${hypothesis.class} ${hypothesis.impact * hypothesis.plausibility}/25] ${hypothesis.statement} (evidence: ${hypothesis.evidence.slice(0, 160)})`,
        );
      }
    }

    if (findings.length > 0) {
      lines.push("Validated findings:");
      for (const finding of findings.slice(0, 12)) {
        lines.push(
          `- [${finding.severity}] ${finding.title} (validator: ${finding.validator})`,
        );
      }
    }

    const lastSummary = [...events]
      .reverse()
      .find((event) => event.type === "assistant.message");
    if (lastSummary) {
      lines.push(
        "Last assistant summary:",
        String(lastSummary.payload.text ?? "").slice(0, 1500),
      );
    }

    return lines.join("\n");
  }
}
