import type { DatabaseSync } from "node:sqlite";
import type { Finding, Severity } from "../../shared/types";

export interface FindingService {
  insert(finding: Finding): void;
  listByRun(runId: string): Finding[];
}

interface FindingRow {
  id: string;
  run_id: string;
  hypothesis_id: string | null;
  title: string;
  severity: Severity;
  class: string;
  evidence: string;
  validator: string;
  status: string;
  created_at: string;
}

export function createFindingService(database: DatabaseSync): FindingService {
  return {
    insert(finding) {
      database
        .prepare(
          `INSERT INTO findings (
            id, run_id, hypothesis_id, title, severity, class, evidence,
            validator, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          finding.id,
          finding.runId,
          finding.hypothesisId,
          finding.title,
          finding.severity,
          finding.class,
          finding.evidence,
          finding.validator,
          finding.status,
          finding.createdAt,
        );
    },

    listByRun(runId) {
      const rows = database
        .prepare(
          `SELECT * FROM findings WHERE run_id = ?
           ORDER BY CASE severity
             WHEN 'critical' THEN 0 WHEN 'high' THEN 1
             WHEN 'medium' THEN 2 ELSE 3 END, created_at ASC`,
        )
        .all(runId) as unknown as FindingRow[];
      return rows.map((row) => ({
        id: row.id,
        runId: row.run_id,
        hypothesisId: row.hypothesis_id,
        title: row.title,
        severity: row.severity,
        class: row.class,
        evidence: row.evidence,
        validator: row.validator,
        status: row.status,
        createdAt: row.created_at,
      }));
    },
  };
}
