import { ipcMain } from "electron";
import type { ProviderId } from "../../shared/types";
import type { AppUseCases } from "./context";

export function registerSettingsHandlers(useCases: AppUseCases): void {
  ipcMain.handle("settings:get", () => useCases.getSettings.execute());

  ipcMain.handle(
    "settings:save",
    (
      _event,
      patch: {
        compactionBudget?: number;
        dockerHost?: string;
        compatibleBaseUrl?: string;
      },
    ) => {
      useCases.saveSettings.execute(patch);
      return useCases.getSettings.execute();
    },
  );

  ipcMain.handle(
    "secrets:set",
    (_event, provider: ProviderId, value: string) => {
      useCases.setProviderKey.execute(provider, value);
    },
  );

  ipcMain.handle("secrets:clear", (_event, provider: ProviderId) => {
    useCases.clearProviderKey.execute(provider);
  });
}
