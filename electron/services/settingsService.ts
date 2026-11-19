import type { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_ENGINE_SETTINGS,
  normalizeEngineSettings,
  type EngineSettings,
} from "../entities/settings";

export interface SettingsService {
  get(): EngineSettings;
  save(settings: EngineSettings): void;
}

export function createSettingsService(database: DatabaseSync): SettingsService {
  function read(key: string): string | null {
    const row = database
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as unknown as { value: string } | undefined;
    return row?.value ?? null;
  }

  function write(key: string, value: string): void {
    database
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  return {
    get(): EngineSettings {
      return normalizeEngineSettings({
        compactionBudget: Number(
          read("compactionBudget") ??
            DEFAULT_ENGINE_SETTINGS.compactionBudget,
        ),
        runTokenBudget: Number(
          read("runTokenBudget") ?? DEFAULT_ENGINE_SETTINGS.runTokenBudget,
        ),
        dockerHost: read("dockerHost") ?? DEFAULT_ENGINE_SETTINGS.dockerHost,
        compatibleBaseUrl:
          read("compatibleBaseUrl") ??
          DEFAULT_ENGINE_SETTINGS.compatibleBaseUrl,
        allowInvalidCertificates:
          (read("allowInvalidCertificates") ?? "false") === "true",
        closeToTray: (read("closeToTray") ?? "true") === "true",
      });
    },

    save(settings) {
      write("compactionBudget", String(settings.compactionBudget));
      write("runTokenBudget", String(settings.runTokenBudget));
      write("dockerHost", settings.dockerHost);
      write("compatibleBaseUrl", settings.compatibleBaseUrl);
      write("allowInvalidCertificates", String(settings.allowInvalidCertificates));
      write("closeToTray", String(settings.closeToTray));
    },
  };
}
