export type WorkspaceType = "web" | "android" | "library";

export type ArtifactKind =
  | "source"
  | "docs"
  | "url"
  | "apk"
  | "lockfile"
  | "sbom"
  | "tarball";

export type LibraryArtifactKind = "lockfile" | "sbom" | "tarball";

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepinfra"
  | "compatible";

export interface ProviderOption {
  id: ProviderId;
  label: string;
  endpoint: string;
  keyLabel: string;
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    endpoint: "https://api.anthropic.com",
    keyLabel: "Anthropic API key",
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1",
    keyLabel: "OpenAI API key",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com",
    keyLabel: "Gemini API key",
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    endpoint: "https://api.deepinfra.com/v1/openai",
    keyLabel: "DeepInfra API key",
  },
  {
    id: "compatible",
    label: "OpenAI-compatible",
    endpoint: "Custom base URL",
    keyLabel: "API key",
  },
];

export interface Artifact {
  id: string;
  workspaceId: string;
  kind: ArtifactKind;
  path: string;
  hash: string | null;
  size: number | null;
  createdAt: string;
}

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type RunEventType =
  | "step.started"
  | "assistant.message"
  | "tool.call"
  | "tool.result"
  | "usage"
  | "run.completed"
  | "run.failed"
  | "run.cancelled";

export interface Run {
  id: string;
  workspaceId: string;
  status: RunStatus;
  provider: ProviderId | null;
  model: string | null;
  thinking: ThinkingLevel | null;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  stepCount: number;
  createdAt: string;
}

export interface RunEvent {
  id: string;
  runId: string;
  seq: number;
  type: RunEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RunDelta {
  runId: string;
  type: "assistant.delta";
  text: string;
}

export type RunUpdate = RunEvent | RunDelta;

export interface ModelInfo {
  provider: ProviderId;
  id: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  targetUrl: string | null;
  targetApkPath: string | null;
  libraryArtifactPath: string | null;
  libraryArtifactKind: LibraryArtifactKind | null;
  sourcePath: string | null;
  docsPath: string | null;
  provider: ProviderId | null;
  model: string | null;
  thinking: ThinkingLevel | null;
  authorizedAt: string | null;
  authorizationNote: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifacts: Artifact[];
}

export interface WorkspaceInput {
  name: string;
  type: WorkspaceType;
  targetUrl?: string | null;
  targetApkPath?: string | null;
  libraryArtifactPath?: string | null;
  libraryArtifactKind?: LibraryArtifactKind | null;
  sourcePath?: string | null;
  docsPath?: string | null;
  provider?: ProviderId | null;
  model?: string | null;
  thinking?: ThinkingLevel | null;
  authorizationNote?: string | null;
}

export interface Settings {
  compactionBudget: number;
  dockerHost: string;
  compatibleBaseUrl: string;
  providerKeys: Record<ProviderId, boolean>;
}

export interface PickPathOptions {
  mode: "file" | "directory";
  title: string;
}

export interface DefensityApi {
  listWorkspaces: () => Promise<Workspace[]>;
  getWorkspace: (id: string) => Promise<Workspace | null>;
  createWorkspace: (input: WorkspaceInput) => Promise<Workspace>;
  archiveWorkspace: (id: string) => Promise<void>;
  pickPath: (options: PickPathOptions) => Promise<string | null>;
  getSettings: () => Promise<Settings>;
  saveSettings: (
    patch: Partial<
      Pick<Settings, "compactionBudget" | "dockerHost" | "compatibleBaseUrl">
    >,
  ) => Promise<Settings>;
  listModels: (provider: ProviderId) => Promise<ModelInfo[]>;
  startRun: (workspaceId: string) => Promise<Run>;
  cancelRun: (runId: string) => Promise<void>;
  getRun: (runId: string) => Promise<Run | null>;
  listRuns: (workspaceId: string) => Promise<Run[]>;
  listRunEvents: (runId: string) => Promise<RunEvent[]>;
  onRunUpdate: (listener: (update: RunUpdate) => void) => () => void;
  setProviderKey: (provider: ProviderId, key: string) => Promise<void>;
  clearProviderKey: (provider: ProviderId) => Promise<void>;
}
