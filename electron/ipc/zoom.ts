import { BrowserWindow, ipcMain, type WebContents } from "electron";

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2;

function applyZoom(contents: WebContents, delta: number): void {
  const current = contents.getZoomFactor();
  const next = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Number((current + delta).toFixed(2))),
  );
  contents.setZoomFactor(next);
}

export function registerZoomHandlers(): void {
  ipcMain.handle("zoom:by", (event, delta: number) => {
    const contents = event.sender;
    const window = BrowserWindow.fromWebContents(contents);
    if (window) {
      applyZoom(contents, delta);
    }
  });
}
