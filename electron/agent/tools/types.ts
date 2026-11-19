import type { AgentFinding, AgentHypothesis } from "../types";

export interface ToolContext {
  root: string | null;
  targetUrl: string | null;
  libraryArtifactPath: string | null;
  allowInvalidCertificates: boolean;
  dockerHost: string;
  /** Normalized titles of issues already registered in this workspace. */
  knownFindingTitles: Set<string>;
  hypotheses: AgentHypothesis[];
  findings: AgentFinding[];
}

export interface ToolResult {
  ok: boolean;
  content: string;
  metadata?: {
    truncated?: boolean;
    nextOffset?: number;
    totalLines?: number;
    startLine?: number;
    endLine?: number;
  };
}

export interface Tool {
  definition: import("../types").AgentTool;
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult>;
}

export const NO_ROOT_MESSAGE =
  "No source or documentation directory is available for this workspace. Only file artifacts were provided.";
