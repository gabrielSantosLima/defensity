export interface ToolContext {
  root: string | null;
  targetUrl: string | null;
  libraryArtifactPath: string | null;
  allowInvalidCertificates: boolean;
}

export interface ToolResult {
  ok: boolean;
  content: string;
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
