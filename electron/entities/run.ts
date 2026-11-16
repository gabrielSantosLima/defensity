import type { Run, RunStatus, ThinkingLevel, WorkspaceType } from "../../shared/types";

export const ACTIVE_RUN_STATUSES: RunStatus[] = ["queued", "running"];

export function isRunActive(status: RunStatus): boolean {
  return ACTIVE_RUN_STATUSES.includes(status);
}

export function isRunTerminal(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export interface NewRunInput {
  id: string;
  workspaceId: string;
  provider: Run["provider"];
  model: string | null;
  thinking: ThinkingLevel | null;
  createdAt: string;
}

export function createRunRecord(input: NewRunInput): Run {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    status: "running",
    provider: input.provider,
    model: input.model,
    thinking: input.thinking,
    startedAt: input.createdAt,
    endedAt: null,
    error: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    stepCount: 0,
    createdAt: input.createdAt,
  };
}

export function workspaceTarget(workspace: {
  type: WorkspaceType;
  targetUrl: string | null;
  targetApkPath: string | null;
  libraryArtifactPath: string | null;
}): string | null {
  if (workspace.type === "web") {
    return workspace.targetUrl;
  }
  if (workspace.type === "android") {
    return workspace.targetApkPath;
  }
  return workspace.libraryArtifactPath;
}
