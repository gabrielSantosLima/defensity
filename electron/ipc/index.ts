import type { AppUseCases } from "./context";
import { registerDialogHandlers } from "./dialog";
import { registerProviderHandlers } from "./providers";
import { registerRunHandlers } from "./runs";
import { registerSandboxHandlers } from "./sandbox";
import { registerSettingsHandlers } from "./settings";
import { registerSystemHandlers } from "./system";
import { registerWorkspaceHandlers } from "./workspaces";
import { registerZoomHandlers } from "./zoom";

export function registerIpc(useCases: AppUseCases): void {
  registerWorkspaceHandlers(useCases);
  registerSettingsHandlers(useCases);
  registerProviderHandlers(useCases);
  registerRunHandlers(useCases);
  registerSandboxHandlers(useCases);
  registerDialogHandlers();
  registerZoomHandlers();
  registerSystemHandlers();
}
