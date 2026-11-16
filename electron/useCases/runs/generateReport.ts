import type { Finding, Severity } from "../../../shared/types";
import type { FindingService } from "../../services/findingService";
import type { HypothesisService } from "../../services/hypothesisService";
import type { RunService } from "../../services/runService";
import type { WorkspaceService } from "../../services/workspaceService";

interface Deps {
  runs: RunService;
  workspaces: WorkspaceService;
  findings: FindingService;
  hypotheses: HypothesisService;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

function duration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) {
    return "—";
  }
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export class GenerateReportUseCase {
  private readonly runs: RunService;
  private readonly workspaces: WorkspaceService;
  private readonly findings: FindingService;
  private readonly hypotheses: HypothesisService;

  constructor({ runs, workspaces, findings, hypotheses }: Deps) {
    this.runs = runs;
    this.workspaces = workspaces;
    this.findings = findings;
    this.hypotheses = hypotheses;
  }

  execute(runId: string): string {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    const workspace = this.workspaces.get(run.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const findings = this.findings.listByRun(runId);
    const hypotheses = this.hypotheses.listByRun(runId);
    const target =
      workspace.targetUrl ??
      workspace.targetApkPath ??
      workspace.libraryArtifactPath ??
      "—";

    const lines: string[] = [
      "# defensity report",
      "",
      `- Workspace: ${workspace.name} (${workspace.type})`,
      `- Target: ${target}`,
      `- Run: ${run.id}`,
      `- Status: ${run.status}`,
      `- Model: ${run.provider ?? "—"} / ${run.model ?? "—"} (thinking: ${run.thinking ?? "off"})`,
      `- Started: ${run.startedAt ?? "—"}`,
      `- Duration: ${duration(run.startedAt, run.endedAt)}`,
      `- Tokens: ${run.totalTokens.toLocaleString()}`,
      "",
      "## Scope",
      "",
      workspace.authorizationNote
        ? `Authorization note: ${workspace.authorizationNote}`
        : "No authorization note was recorded.",
      "",
      "## Issues",
      "",
    ];

    if (findings.length === 0) {
      lines.push("No validated issues were recorded.");
    } else {
      for (const finding of findings) {
        lines.push(
          `### [${SEVERITY_LABEL[finding.severity as Severity]}] ${finding.title}`,
          "",
          `- Class: ${finding.class}`,
          `- Validator: ${finding.validator}`,
          `- Evidence: ${finding.evidence}`,
          "",
        );
      }
    }

    lines.push("", "## Hypotheses", "");
    if (hypotheses.length === 0) {
      lines.push("No hypotheses were recorded.");
    } else {
      for (const hypothesis of hypotheses) {
        lines.push(
          `- [${hypothesis.class} ${hypothesis.impact * hypothesis.plausibility}/25] ${hypothesis.statement}`,
          `  - Rationale: ${hypothesis.rationale}`,
          `  - Evidence: ${hypothesis.evidence}`,
        );
      }
    }

    lines.push(
      "",
      "## Metrics",
      "",
      `- Steps: ${run.stepCount}`,
      `- Tokens: ${run.totalTokens.toLocaleString()}`,
      `- Issues: ${findings.length}`,
      `- Hypotheses: ${hypotheses.length}`,
      "",
    );

    return lines.join("\n");
  }
}
