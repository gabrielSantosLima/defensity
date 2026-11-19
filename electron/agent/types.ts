import type {
  ProviderId,
  RunStatus,
  ThinkingLevel,
  WorkspaceType,
} from "../../shared/types";

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentMessage {
  id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  /** Marks pinned messages so compaction can preserve them. */
  kind?: "task" | "checkpoint";
  /** The summary text held by a checkpoint message. */
  checkpoint?: string;
}

export interface AgentHypothesis {
  statement: string;
  class: string;
  impact: number;
  plausibility: number;
  rationale: string;
  evidence: string;
  proposedTest: string | null;
}

export interface AgentFinding {
  title: string;
  severity: string;
  class: string;
  evidence: string;
  validator: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatRequest {
  messages: AgentMessage[];
  tools: AgentTool[];
  signal: AbortSignal;
  onDelta?: (text: string) => void;
}

export interface ChatResult {
  text: string;
  toolCalls: AgentToolCall[];
  usage: Usage | null;
}

export interface ChatProvider {
  chat(request: ChatRequest): Promise<ChatResult>;
}

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface AgentWorkspace {
  id: string;
  name: string;
  type: WorkspaceType;
  targetUrl: string | null;
  targetApkPath: string | null;
  libraryArtifactPath: string | null;
  sourcePath: string | null;
  docsPath: string | null;
}

export interface AgentStartPayload {
  runId: string;
  provider: ProviderId;
  model: string;
  thinking: ThinkingLevel | null;
  apiKey: string;
  baseUrl: string;
  workspace: AgentWorkspace;
  limits: { maxToolResultChars: number };
  seed?: string;
  knownHypotheses?: AgentHypothesis[];
  knownFindings?: AgentFinding[];
  dockerHost?: string;
  allowInvalidCertificates: boolean;
}

export type AgentEventType =
  | "step.started"
  | "assistant.message"
  | "tool.call"
  | "tool.result"
  | "finding"
  | "hypothesis"
  | "compaction"
  | "usage";

export interface AgentEmit {
  (type: AgentEventType, payload: Record<string, unknown>): void;
  delta(text: string): void;
}

export type AgentOutbound =
  | {
      kind: "event";
      type: AgentEventType;
      payload: Record<string, unknown>;
    }
  | { kind: "delta"; text: string }
  | {
      kind: "finish";
      status: Extract<RunStatus, "completed" | "failed" | "cancelled">;
      error?: string;
      usage: Usage;
      steps: number;
    };

export type AgentInbound =
  | { kind: "start"; payload: AgentStartPayload }
  | { kind: "cancel" };
