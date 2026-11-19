import type { AgentTool } from "../types";
import { normalizeFindingTitle } from "../../../shared/findings";
import { depsScanTool } from "./depsScan";
import { fsGrepTool } from "./fsGrep";
import { fsListTool } from "./fsList";
import { fsReadTool } from "./fsRead";
import { findingRecordTool } from "./findingRecord";
import { hypothesisListTool } from "./hypothesisList";
import { hypothesisRecordTool } from "./hypothesisRecord";
import { loadRunTool } from "./loadRun";
import type { Tool, ToolContext, ToolResult } from "./types";
import { probeRunTool } from "./probeRun";
import { webFetchTool } from "./webFetch";

const TOOLS: Tool[] = [
  fsListTool,
  fsReadTool,
  fsGrepTool,
  webFetchTool,
  depsScanTool,
  probeRunTool,
  loadRunTool,
  hypothesisListTool,
  hypothesisRecordTool,
  findingRecordTool,
];

export interface Toolset {
  definitions: AgentTool[];
  context: ToolContext;
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export function createToolset(context: ToolContext): Toolset {
  const scopedContext: ToolContext = {
    ...context,
    knownFindingTitles: new Set(
      [...context.knownFindingTitles].map(normalizeFindingTitle),
    ),
  };

  return {
    definitions: TOOLS.map((tool) => tool.definition),
    context: scopedContext,

    async execute(name, args) {
      const tool = TOOLS.find((entry) => entry.definition.name === name);
      if (!tool) {
        return { ok: false, content: `Unknown tool: ${name}` };
      }

      try {
        return await tool.execute(args, scopedContext);
      } catch (error) {
        return {
          ok: false,
          content: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
