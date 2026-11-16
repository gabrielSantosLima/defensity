import type { ProviderId } from "../../../shared/types";
import type { SecretService } from "../../services/secretService";

export class ClearProviderKeyUseCase {
  constructor(private readonly secrets: SecretService) {}

  execute(provider: ProviderId): void {
    this.secrets.clear(provider);
  }
}
