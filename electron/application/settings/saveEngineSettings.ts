import {
  assertEnginePatch,
  normalizeEngineSettings,
  type EngineSettings,
} from "../../domain/entities/settings";
import type { SettingsRepository } from "../../domain/ports/settingsRepository";

export function saveEngineSettings(
  patch: {
    compactionBudget?: number;
    dockerHost?: string;
    compatibleBaseUrl?: string;
  },
  repository: SettingsRepository,
): EngineSettings {
  assertEnginePatch(patch);
  const current = repository.get();
  const next = normalizeEngineSettings({ ...current, ...patch });
  repository.save(next);
  return next;
}
