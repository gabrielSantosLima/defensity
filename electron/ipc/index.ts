import type { IpcContext } from "./context";
import { registerDialogHandlers } from "./dialog";
import { registerProviderHandlers } from "./providers";
import { registerSettingsHandlers } from "./settings";
import { registerWorkspaceHandlers } from "./workspaces";

export function registerIpc(context: IpcContext): void {
  registerWorkspaceHandlers(context);
  registerSettingsHandlers(context);
  registerProviderHandlers(context);
  registerDialogHandlers();
}
