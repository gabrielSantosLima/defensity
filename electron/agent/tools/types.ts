import type { AgentTool } from "../types";

export interface ToolResult {
  ok: boolean;
  content: string;
}

export interface Tool {
  definition: AgentTool;
  execute(args: Record<string, unknown>, root: string): Promise<ToolResult>;
}
