import type { DatabaseSync } from "node:sqlite";
import type { Hypothesis } from "../../shared/types";

export interface HypothesisService {
  insert(hypothesis: Hypothesis): void;
  listByRun(runId: string): Hypothesis[];
  listByWorkspace(workspaceId: string): Hypothesis[];
}

interface HypothesisRow {
  id: string;
  run_id: string;
  statement: string;
  class: string;
  impact: number;
  plausibility: number;
  rationale: string;
  evidence: string;
  proposed_test: string | null;
  created_at: string;
}

function toHypothesis(row: HypothesisRow): Hypothesis {
  return {
    id: row.id,
    runId: row.run_id,
    statement: row.statement,
    class: row.class,
    impact: row.impact,
    plausibility: row.plausibility,
    rationale: row.rationale,
    evidence: row.evidence,
    proposedTest: row.proposed_test,
    createdAt: row.created_at,
  };
}

export function createHypothesisService(
  database: DatabaseSync,
): HypothesisService {
  return {
    insert(hypothesis) {
      database
        .prepare(
          `INSERT INTO hypotheses (
            id, run_id, statement, class, impact, plausibility, rationale,
            evidence, proposed_test, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          hypothesis.id,
          hypothesis.runId,
          hypothesis.statement,
          hypothesis.class,
          hypothesis.impact,
          hypothesis.plausibility,
          hypothesis.rationale,
          hypothesis.evidence,
          hypothesis.proposedTest,
          hypothesis.createdAt,
        );
    },

    listByRun(runId) {
      const rows = database
        .prepare(
          `SELECT * FROM hypotheses WHERE run_id = ?
           ORDER BY impact * plausibility DESC, created_at ASC`,
        )
        .all(runId) as unknown as HypothesisRow[];
      return rows.map(toHypothesis);
    },

    listByWorkspace(workspaceId) {
      const rows = database
        .prepare(
          `SELECT h.* FROM hypotheses h
           JOIN runs r ON r.id = h.run_id
           WHERE r.workspace_id = ?
           ORDER BY h.created_at DESC`,
        )
        .all(workspaceId) as unknown as HypothesisRow[];
      return rows.map(toHypothesis);
    },
  };
}
