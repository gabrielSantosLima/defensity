import { writeFile } from "node:fs/promises";
import { dialog, ipcMain } from "electron";
import type { AppUseCases } from "./context";

export function registerRunHandlers(useCases: AppUseCases): void {
  ipcMain.handle("runs:start", (_event, workspaceId: string) =>
    useCases.startRun.execute(workspaceId),
  );

  ipcMain.handle("runs:rerun", (_event, runId: string) =>
    useCases.rerunRun.execute(runId),
  );

  ipcMain.handle("runs:continue", (_event, runId: string) =>
    useCases.continueRun.execute(runId),
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

  ipcMain.handle("runs:clear", (_event, workspaceId: string) => {
    useCases.clearRunHistory.execute(workspaceId);
  });

  ipcMain.handle("runs:events", (_event, runId: string) =>
    useCases.listRunEvents.execute(runId),
  );

  ipcMain.handle("runs:hypotheses", (_event, runId: string) =>
    useCases.listHypotheses.execute(runId),
  );

  ipcMain.handle("runs:findings", (_event, runId: string) =>
    useCases.listFindings.execute(runId),
  );

  ipcMain.handle("issues:list", (_event, workspaceId: string) =>
    useCases.listWorkspaceIssues.execute(workspaceId),
  );

  ipcMain.handle("reports:generate", (_event, runId: string) =>
    useCases.generateReport.execute(runId),
  );

  ipcMain.handle("reports:save", async (_event, runId: string) => {
    const markdown = useCases.generateReport.execute(runId);
    const result = await dialog.showSaveDialog({
      title: "Save defensity report",
      defaultPath: `defensity-report-${runId.slice(0, 8)}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    await writeFile(result.filePath, markdown, "utf8");
    return result.filePath;
  });
}
