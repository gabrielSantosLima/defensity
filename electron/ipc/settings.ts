import { ipcMain } from "electron";
import {
  PROVIDERS,
  type ProviderId,
  type Settings,
} from "../../shared/types";
import { saveEngineSettings } from "../application/settings/saveEngineSettings";
import type { IpcContext } from "./context";

function withKeyState(context: IpcContext): Settings {
  const base = context.settings.get();
  const providerKeys = Object.fromEntries(
    PROVIDERS.map((provider) => [provider.id, context.secrets.has(provider.id)]),
  ) as Record<ProviderId, boolean>;
  return { ...base, providerKeys };
}

export function registerSettingsHandlers(context: IpcContext): void {
  ipcMain.handle("settings:get", () => withKeyState(context));

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
      saveEngineSettings(patch, context.settings);
      return withKeyState(context);
    },
  );

  ipcMain.handle(
    "secrets:set",
    (_event, provider: ProviderId, value: string) => {
      context.secrets.set(provider, value);
    },
  );

  ipcMain.handle("secrets:clear", (_event, provider: ProviderId) => {
    context.secrets.clear(provider);
  });
}
