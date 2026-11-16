import { ipcMain } from "electron";
import type { AppUseCases } from "./context";

export function registerRunHandlers(useCases: AppUseCases): void {
  ipcMain.handle("runs:start", (_event, workspaceId: string) =>
    useCases.startRun.execute(workspaceId),
  );

  ipcMain.handle("runs:cancel", (_event, runId: string) => {
    useCases.cancelRun.execute(runId);
  });

  ipcMain.handle("runs:get", (_event, runId: string) =>
    useCases.getRun.execute(runId),
  );

  ipcMain.handle("runs:list", (_event, workspaceId: string) =>
    useCases.listRuns.execute(workspaceId),
  );

  ipcMain.handle("runs:events", (_event, runId: string) =>
    useCases.listRunEvents.execute(runId),
  );

  ipcMain.handle("runs:hypotheses", (_event, runId: string) =>
    useCases.listHypotheses.execute(runId),
  );
}
