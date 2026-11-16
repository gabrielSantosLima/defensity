export interface EngineSettings {
  compactionBudget: number;
  runTokenBudget: number;
  dockerHost: string;
  compatibleBaseUrl: string;
  allowInvalidCertificates: boolean;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  compactionBudget: 120000,
  runTokenBudget: 200000,
  dockerHost: "",
  compatibleBaseUrl: "",
  allowInvalidCertificates: false,
};

export const MIN_COMPACTION_BUDGET = 20000;
export const MIN_RUN_TOKEN_BUDGET = 10000;

export function normalizeEngineSettings(input: {
  compactionBudget?: number;
  runTokenBudget?: number;
  dockerHost?: string;
  compatibleBaseUrl?: string;
  allowInvalidCertificates?: boolean;
}): EngineSettings {
  const budget = Number(input.compactionBudget);
  const validBudget =
    Number.isFinite(budget) && budget >= MIN_COMPACTION_BUDGET
      ? Math.round(budget)
      : DEFAULT_ENGINE_SETTINGS.compactionBudget;

  const runBudget = Number(input.runTokenBudget);
  const validRunBudget =
    Number.isFinite(runBudget) && runBudget >= MIN_RUN_TOKEN_BUDGET
      ? Math.round(runBudget)
      : DEFAULT_ENGINE_SETTINGS.runTokenBudget;

  return {
    compactionBudget: validBudget,
    runTokenBudget: validRunBudget,
    dockerHost: input.dockerHost?.trim() ?? DEFAULT_ENGINE_SETTINGS.dockerHost,
    compatibleBaseUrl:
      input.compatibleBaseUrl?.trim() ??
      DEFAULT_ENGINE_SETTINGS.compatibleBaseUrl,
    allowInvalidCertificates: Boolean(input.allowInvalidCertificates),
  };
}

export function assertEnginePatch(patch: {
  compactionBudget?: number;
  runTokenBudget?: number;
  dockerHost?: string;
  compatibleBaseUrl?: string;
  allowInvalidCertificates?: boolean;
}): void {
  if (patch.runTokenBudget !== undefined) {
    if (
      !Number.isFinite(patch.runTokenBudget) ||
      patch.runTokenBudget < MIN_RUN_TOKEN_BUDGET
    ) {
      throw new Error(
        `Run token budget must be at least ${MIN_RUN_TOKEN_BUDGET.toLocaleString("en-US")} tokens`,
      );
    }
  }
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
