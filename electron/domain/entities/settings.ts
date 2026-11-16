export interface EngineSettings {
  compactionBudget: number;
  dockerHost: string;
  compatibleBaseUrl: string;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  compactionBudget: 120000,
  dockerHost: "",
  compatibleBaseUrl: "",
};

export const MIN_COMPACTION_BUDGET = 20000;

export function normalizeEngineSettings(input: {
  compactionBudget?: number;
  dockerHost?: string;
  compatibleBaseUrl?: string;
}): EngineSettings {
  const budget = Number(input.compactionBudget);
  const validBudget =
    Number.isFinite(budget) && budget >= MIN_COMPACTION_BUDGET
      ? Math.round(budget)
      : DEFAULT_ENGINE_SETTINGS.compactionBudget;

  return {
    compactionBudget: validBudget,
    dockerHost: input.dockerHost?.trim() ?? DEFAULT_ENGINE_SETTINGS.dockerHost,
    compatibleBaseUrl:
      input.compatibleBaseUrl?.trim() ??
      DEFAULT_ENGINE_SETTINGS.compatibleBaseUrl,
  };
}

export function assertEnginePatch(patch: {
  compactionBudget?: number;
  dockerHost?: string;
  compatibleBaseUrl?: string;
}): void {
  if (patch.compactionBudget !== undefined) {
    if (
      !Number.isFinite(patch.compactionBudget) ||
      patch.compactionBudget < MIN_COMPACTION_BUDGET
    ) {
      throw new Error(
        `Compaction budget must be at least ${MIN_COMPACTION_BUDGET.toLocaleString("en-US")} tokens`,
      );
    }
  }
}
