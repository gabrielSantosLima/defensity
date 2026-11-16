import {
  PROVIDERS,
  type ModelInfo,
  type ProviderId,
} from "../../../shared/types";
import type { ProviderService } from "../../services/providerService";
import type { SecretService } from "../../services/secretService";
import type { SettingsService } from "../../services/settingsService";

interface Deps {
  providers: ProviderService;
  secrets: SecretService;
  settings: SettingsService;
}

export class ListModelsUseCase {
  private readonly providers: ProviderService;
  private readonly secrets: SecretService;
  private readonly settings: SettingsService;

  constructor({ providers, secrets, settings }: Deps) {
    this.providers = providers;
    this.secrets = secrets;
    this.settings = settings;
  }

  async execute(provider: ProviderId): Promise<ModelInfo[]> {
    if (!PROVIDERS.some((entry) => entry.id === provider)) {
      throw new Error("Unknown provider");
    }

    const apiKey = this.secrets.read(provider);
    if (!apiKey) {
      throw new Error("No API key configured for this provider");
    }

    const compatibleBaseUrl = this.settings.get().compatibleBaseUrl;
    if (provider === "compatible" && !compatibleBaseUrl.trim()) {
      throw new Error("Set the base URL for the OpenAI-compatible provider");
    }

    const models = await this.providers.listModels(
      provider,
      apiKey,
      compatibleBaseUrl,
    );
    return models.sort((a, b) => a.name.localeCompare(b.name));
  }
}
