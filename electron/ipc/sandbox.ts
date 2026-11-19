import { ipcMain } from "electron";
import type { AppUseCases } from "./context";

export function registerSandboxHandlers(useCases: AppUseCases): void {
  ipcMain.handle("sandbox:status", () => useCases.getSandboxStatus.execute());

  ipcMain.handle("sandbox:build", (event) =>
    useCases.buildSandboxImages.execute((chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("sandbox:progress", chunk);
      }
    }),
  );
}
