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
import { buildRunContext } from "./runContext";

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

    // Only web workspaces need the validation sandbox at run start. Static
    // library and Android analysis run without containers.
    if (workspace.type === "web") {
      this.sandbox.preflight();
    }

    const baseUrl = baseUrlFor(
      workspace.provider,
      this.settings.get().compatibleBaseUrl,
    );
    if (!baseUrl) {
      throw new Error("Set the base URL for the OpenAI-compatible provider");
    }

    const knownIssues = this.findings.listByWorkspace(workspace.id);
    const workspaceHypotheses = this.hypotheses.listByWorkspace(workspace.id);
    let sourceRun: Run | null = null;
    let sourceEvents: ReturnType<RunService["listEvents"]> = [];
    if (options?.rerunOf) {
      const previous = this.runs.get(options.rerunOf);
      if (!previous || previous.workspaceId !== workspaceId) {
        throw new Error("Previous run not found for this workspace");
      }
      sourceRun = previous;
      sourceEvents = this.runs.listEvents(previous.id);
    }

    const seed = buildRunContext({
      issues: knownIssues,
      hypotheses: workspaceHypotheses,
      sourceRun,
      sourceEvents,
      checkpoint: sourceRun
        ? this.latestCheckpointFromEvents(sourceEvents)
        : this.latestCheckpoint(workspace.id),
    });

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
      knownHypotheses: workspaceHypotheses.map((hypothesis) => ({
        statement: hypothesis.statement,
        class: hypothesis.class,
        impact: hypothesis.impact,
        plausibility: hypothesis.plausibility,
        rationale: hypothesis.rationale,
        evidence: hypothesis.evidence,
        proposedTest: hypothesis.proposedTest,
      })),
      knownFindings: knownIssues.map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        class: finding.class,
        evidence: finding.evidence,
        validator: finding.validator,
      })),
      dockerHost: this.settings.get().dockerHost,
      allowInvalidCertificates:
        this.settings.get().allowInvalidCertificates,
      limits: {
        maxToolResultChars: 12000,
      },
    });

    return run;
  }

  private latestCheckpointFromEvents(
    events: ReturnType<RunService["listEvents"]>,
  ): string | null {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type === "compaction" && typeof event.payload.summary === "string") {
        const summary = event.payload.summary.trim();
        if (summary) {
          return summary;
        }
      }
    }
    return null;
  }

  private latestCheckpoint(workspaceId: string): string | null {
    for (const previous of this.runs.listByWorkspace(workspaceId)) {
      const summary = this.latestCheckpointFromEvents(
        this.runs.listEvents(previous.id),
      );
      if (summary) {
        return summary;
      }
    }
    return null;
  }
}
