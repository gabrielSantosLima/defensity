import { BrowserWindow, dialog, ipcMain } from "electron";
import type { PickPathOptions } from "../../shared/types";

export function registerDialogHandlers(): void {
  ipcMain.handle(
    "dialog:pickPath",
    async (event, options: PickPathOptions): Promise<string | null> => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const properties: Array<"openFile" | "openDirectory" | "createDirectory"> =
        options.mode === "directory"
          ? ["openDirectory", "createDirectory"]
          : ["openFile"];
      const dialogOptions = {
        title: options.title,
        properties,
      };
      const result = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    },
  );
}
