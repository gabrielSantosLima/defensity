import type { Run } from "../../../shared/types";
import { buildResumeMessages } from "../../agent/resume";
import { baseUrlFor } from "../../entities/provider";
import { isRunActive } from "../../entities/run";
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

export class ContinueRunUseCase {
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

  execute(runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    if (isRunActive(run.status)) {
      throw new Error("This run is already active");
    }

    const workspace = this.workspaces.get(run.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    if (!workspace.provider || !workspace.model) {
      throw new Error("Choose a provider and a model before continuing");
    }

    const apiKey = this.secrets.read(workspace.provider);
    if (!apiKey) {
      throw new Error("Add an API key for this provider in Settings");
    }

    const otherActive = this.runs
      .listByWorkspace(workspace.id)
      .find((entry) => entry.id !== run.id && isRunActive(entry.status));
    if (otherActive) {
      throw new Error("Another run is already active for this workspace");
    }

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

    const events = this.runs.listEvents(run.id);
    const resumeMessages = buildResumeMessages(events);
    const knownIssues = this.findings.listByWorkspace(workspace.id);
    const knownHypotheses = this.hypotheses.listByWorkspace(workspace.id);
    const continued: Run = {
      ...run,
      status: "running",
      endedAt: null,
      error: null,
    };

    this.runs.reopen(run.id);
    this.runs.appendEvent({
      id: this.ids.newId(),
      runId: run.id,
      type: "run.continued",
      payload: { fromStep: run.stepCount },
      createdAt: this.clock.now(),
    });
    try {
      this.agent.start({
        run: continued,
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
        resumeMessages,
        startStep: run.stepCount + 1,
        knownHypotheses: knownHypotheses.map((hypothesis) => ({
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
        limits: { maxToolResultChars: 12000 },
      });
    } catch (error) {
      this.runs.setStatus(run.id, "failed", {
        endedAt: this.clock.now(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return continued;
  }
}
