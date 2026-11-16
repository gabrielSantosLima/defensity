import type { ProviderId } from "../../../shared/types";
import type { SecretService } from "../../services/secretService";

export class SetProviderKeyUseCase {
  constructor(private readonly secrets: SecretService) {}

  execute(provider: ProviderId, value: string): void {
    this.secrets.set(provider, value);
  }
}
