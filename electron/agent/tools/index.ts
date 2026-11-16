import type { AgentTool } from "../types";
import { fsGrepTool } from "./fsGrep";
import { fsListTool } from "./fsList";
import { fsReadTool } from "./fsRead";
import type { Tool, ToolResult } from "./types";

const TOOLS: Tool[] = [fsListTool, fsReadTool, fsGrepTool];

export interface Toolset {
  definitions: AgentTool[];
  execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult>;
}

export function createToolset(root: string | null): Toolset {
  return {
    definitions: TOOLS.map((tool) => tool.definition),

    async execute(name, args) {
      if (!root) {
        return {
          ok: false,
          content:
            "No source or documentation directory is available for this workspace. Only file artifacts were provided.",
        };
      }

      const tool = TOOLS.find((entry) => entry.definition.name === name);
      if (!tool) {
        return { ok: false, content: `Unknown tool: ${name}` };
      }

      try {
        return await tool.execute(args, root);
      } catch (error) {
        return {
          ok: false,
          content: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
