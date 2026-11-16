import type { EngineSettings } from "../entities/settings";

export interface SettingsRepository {
  get(): EngineSettings;
  save(settings: EngineSettings): void;
}
