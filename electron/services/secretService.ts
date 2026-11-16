import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ProviderId } from "../../shared/types";

export interface SecretService {
  has(provider: ProviderId): boolean;
  read(provider: ProviderId): string | null;
  set(provider: ProviderId, value: string): void;
  clear(provider: ProviderId): void;
}

export interface Cipher {
  available(): boolean;
  encrypt(value: string): string;
  decrypt(value: string): string;
}

type StoredSecrets = Partial<Record<ProviderId, string>>;

export function createSecretService(
  filePath: string,
  cipher: Cipher,
): SecretService {
  function read(): StoredSecrets {
    if (!existsSync(filePath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as StoredSecrets;
    } catch {
      throw new Error("The secret store is unreadable");
    }
  }

  function write(store: StoredSecrets): void {
    writeFileSync(filePath, JSON.stringify(store), "utf8");
  }

  function assertAvailable(): void {
    if (!cipher.available()) {
      throw new Error(
        "The operating system keychain is unavailable, so API keys cannot be stored securely",
      );
    }
  }

  return {
    has(provider) {
      return Boolean(read()[provider]);
    },

    read(provider) {
      const encrypted = read()[provider];
      if (!encrypted) {
        return null;
      }
      assertAvailable();
      return cipher.decrypt(encrypted);
    },

    set(provider, value) {
      assertAvailable();
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("The API key is empty");
      }
      const store = read();
      store[provider] = cipher.encrypt(trimmed);
      write(store);
    },

    clear(provider) {
      const store = read();
      delete store[provider];
      write(store);
    },
  };
}
