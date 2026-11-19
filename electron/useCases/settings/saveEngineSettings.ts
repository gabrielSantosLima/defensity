import {
  normalizeEngineSettings,
  type EngineSettings,
} from "../../entities/settings";
import type { SettingsService } from "../../services/settingsService";

export class SaveEngineSettingsUseCase {
  constructor(private readonly settings: SettingsService) {}

  execute(patch: {
    dockerHost?: string;
    compatibleBaseUrl?: string;
    allowInvalidCertificates?: boolean;
    closeToTray?: boolean;
  }): EngineSettings {
    const current = this.settings.get();
    const next = normalizeEngineSettings({ ...current, ...patch });
    this.settings.save(next);
    return next;
  }
}
