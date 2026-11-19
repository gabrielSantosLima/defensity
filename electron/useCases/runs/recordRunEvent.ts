import type {
  RunEvent,
  RunEventType,
} from "../../../shared/types";
import { normalizeFindingTitle } from "../../../shared/findings";
import type { Clock, Ids } from "../../services/clock";
import type { FindingService } from "../../services/findingService";
import type { HypothesisService } from "../../services/hypothesisService";
import type { RunService } from "../../services/runService";

interface Deps {
  runs: RunService;
  hypotheses: HypothesisService;
  findings: FindingService;
  clock: Clock;
  ids: Ids;
}

export class RecordRunEventUseCase {
  private readonly runs: RunService;
  private readonly hypotheses: HypothesisService;
  private readonly findings: FindingService;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor({ runs, hypotheses, findings, clock, ids }: Deps) {
    this.runs = runs;
    this.hypotheses = hypotheses;
    this.findings = findings;
    this.clock = clock;
    this.ids = ids;
  }

  execute(input: {
    runId: string;
    type: RunEventType;
    payload: Record<string, unknown>;
  }): RunEvent {
    if (input.type === "usage") {
      this.runs.addUsage(input.runId, {
        promptTokens: Number(input.payload.promptTokens ?? 0),
        completionTokens: Number(input.payload.completionTokens ?? 0),
        totalTokens: Number(input.payload.totalTokens ?? 0),
      });
    }
    if (input.type === "step.started") {
      this.runs.setStepCount(input.runId, Number(input.payload.step ?? 0));
    }
    if (input.type === "hypothesis") {
      this.hypotheses.insert({
        id: this.ids.newId(),
        runId: input.runId,
        statement: String(input.payload.statement ?? ""),
        class: String(input.payload.class ?? "other"),
        impact: Number(input.payload.impact ?? 0),
        plausibility: Number(input.payload.plausibility ?? 0),
        rationale: String(input.payload.rationale ?? ""),
        evidence: String(input.payload.evidence ?? ""),
        proposedTest: input.payload.proposedTest
          ? String(input.payload.proposedTest)
          : null,
        createdAt: this.clock.now(),
      });
    }

    if (input.type === "finding") {
      const title = String(input.payload.title ?? "").trim();
      const run = this.runs.get(input.runId);
      const duplicate = run
        ? this.findings
            .listByWorkspace(run.workspaceId)
            .some(
              (existing) =>
                normalizeFindingTitle(existing.title) ===
                normalizeFindingTitle(title),
            )
        : false;

      if (duplicate) {
        // The tool layer already refuses duplicates. This guard keeps an old
        // or misbehaving agent from registering the same issue twice.
        input.payload = { ...input.payload, duplicate: true };
      } else {
        this.findings.insert({
          id: this.ids.newId(),
          runId: input.runId,
          hypothesisId: input.payload.hypothesisId
            ? String(input.payload.hypothesisId)
            : null,
          title,
          severity: String(input.payload.severity ?? "low") as never,
          class: String(input.payload.class ?? "other"),
          evidence: String(input.payload.evidence ?? ""),
          validator: String(input.payload.validator ?? ""),
          status: "open",
          createdAt: this.clock.now(),
        });
      }
    }

    const createdAt = this.clock.now();
    const id = this.ids.newId();
    const seq = this.runs.appendEvent({
      id,
      runId: input.runId,
      type: input.type,
      payload: input.payload,
      createdAt,
    });

    return {
      id,
      runId: input.runId,
      seq,
      type: input.type,
      payload: input.payload,
      createdAt,
    };
  }
}
