import { ipcMain, shell } from "electron";

export function registerSystemHandlers(): void {
  ipcMain.handle("app:openExternal", async (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https links can be opened");
    }
    await shell.openExternal(parsed.toString());
  });
}
