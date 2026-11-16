import type { ProviderId } from "../../../shared/types";

export interface SecretStore {
  has(provider: ProviderId): boolean;
  read(provider: ProviderId): string | null;
  set(provider: ProviderId, value: string): void;
  clear(provider: ProviderId): void;
}
