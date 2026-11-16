import type { AppUseCases } from "./context";
import { registerDialogHandlers } from "./dialog";
import { registerProviderHandlers } from "./providers";
import { registerRunHandlers } from "./runs";
import { registerSettingsHandlers } from "./settings";
import { registerSystemHandlers } from "./system";
import { registerWorkspaceHandlers } from "./workspaces";
import { registerZoomHandlers } from "./zoom";

export function registerIpc(useCases: AppUseCases): void {
  registerWorkspaceHandlers(useCases);
  registerSettingsHandlers(useCases);
  registerProviderHandlers(useCases);
  registerRunHandlers(useCases);
  registerDialogHandlers();
  registerZoomHandlers();
  registerSystemHandlers();
}
