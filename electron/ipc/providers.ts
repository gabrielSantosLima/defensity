import { ipcMain } from "electron";
import type { ProviderId } from "../../shared/types";
import type { AppUseCases } from "./context";

export function registerProviderHandlers(useCases: AppUseCases): void {
  ipcMain.handle("providers:listModels", (_event, provider: ProviderId) =>
    useCases.listModels.execute(provider),
  );
}
