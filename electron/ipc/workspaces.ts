import { ipcMain } from "electron";
import type { WorkspaceInput } from "../../shared/types";
import { createWorkspace } from "../application/workspaces/createWorkspace";
import type { IpcContext } from "./context";

export function registerWorkspaceHandlers(context: IpcContext): void {
  ipcMain.handle("workspaces:list", () => context.workspaces.list());

  ipcMain.handle("workspaces:get", (_event, id: string) =>
    context.workspaces.get(id),
  );

  ipcMain.handle("workspaces:create", (_event, input: WorkspaceInput) =>
    createWorkspace(input, {
      repository: context.workspaces,
      fingerprint: context.fingerprint,
      now: context.now,
      newId: context.newId,
    }),
  );

  ipcMain.handle("workspaces:archive", (_event, id: string) => {
    context.workspaces.archive(id, context.now());
  });
}
