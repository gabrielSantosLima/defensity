import type { Fingerprint } from "../domain/ports/fingerprint";
import type { SecretStore } from "../domain/ports/secretStore";
import type { SettingsRepository } from "../domain/ports/settingsRepository";
import type { WorkspaceRepository } from "../domain/ports/workspaceRepository";

export interface IpcContext {
  workspaces: WorkspaceRepository;
  settings: SettingsRepository;
  secrets: SecretStore;
  fingerprint: Fingerprint;
  now: () => string;
  newId: () => string;
}
