import { ipcMain } from "electron";
import type { ProviderId } from "../../shared/types";
import { fetchModels } from "../infrastructure/providers/modelCatalog";
import type { IpcContext } from "./context";

const PROVIDER_IDS: ProviderId[] = [
  "anthropic",
  "openai",
  "gemini",
  "deepinfra",
  "compatible",
];

export function registerProviderHandlers(context: IpcContext): void {
  ipcMain.handle("providers:listModels", async (_event, provider: ProviderId) => {
    if (!PROVIDER_IDS.includes(provider)) {
      throw new Error("Unknown provider");
    }
    const models = await fetchModels(provider, {
      apiKey: (id) => context.secrets.read(id),
      compatibleBaseUrl: context.settings.get().compatibleBaseUrl,
    });
    return models.sort((a, b) => a.name.localeCompare(b.name));
  });
}
