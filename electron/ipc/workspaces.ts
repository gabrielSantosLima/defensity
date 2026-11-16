import { ipcMain } from "electron";
import type { WorkspaceInput } from "../../shared/types";
import type { AppUseCases } from "./context";

export function registerWorkspaceHandlers(useCases: AppUseCases): void {
  ipcMain.handle("workspaces:list", () => useCases.listWorkspaces.execute());

  ipcMain.handle("workspaces:get", (_event, id: string) =>
    useCases.getWorkspace.execute(id),
  );

  ipcMain.handle("workspaces:create", (_event, input: WorkspaceInput) =>
    useCases.createWorkspace.execute(input),
  );

  ipcMain.handle("workspaces:archive", (_event, id: string) => {
    useCases.archiveWorkspace.execute(id);
  });

  ipcMain.handle(
    "workspaces:update",
    (_event, id: string, input: WorkspaceInput) =>
      useCases.updateWorkspace.execute(id, input),
  );

  ipcMain.handle("workspaces:delete", (_event, id: string) => {
    useCases.deleteWorkspace.execute(id);
  });
}
