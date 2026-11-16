import {
  PROVIDERS,
  type ProviderId,
  type Settings,
} from "../../../shared/types";
import type { SecretService } from "../../services/secretService";
import type { SettingsService } from "../../services/settingsService";

interface Deps {
  settings: SettingsService;
  secrets: SecretService;
}

export class GetSettingsUseCase {
  private readonly settings: SettingsService;
  private readonly secrets: SecretService;

  constructor({ settings, secrets }: Deps) {
    this.settings = settings;
    this.secrets = secrets;
  }

  execute(): Settings {
    const base = this.settings.get();
    const providerKeys = Object.fromEntries(
      PROVIDERS.map((provider) => [
        provider.id,
        this.secrets.has(provider.id),
      ]),
    ) as Record<ProviderId, boolean>;

    return { ...base, providerKeys };
  }
}
