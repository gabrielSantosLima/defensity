import { BrowserWindow, shell } from "electron";
import path from "node:path";

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

export function createMainWindow(devServerUrl?: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#070a0c",
    icon: path.join(__dirname, "../../../build/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: Boolean(devServerUrl),
    },
  });

  window.once("ready-to-show", () => {
    window.maximize();
    window.show();
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (!input.control && !input.meta) {
      return;
    }
    const current = window.webContents.getZoomFactor();
    if (input.key === "+" || input.key === "=") {
      window.webContents.setZoomFactor(clampZoom(current + ZOOM_STEP));
      event.preventDefault();
    } else if (input.key === "-" || input.key === "_") {
      window.webContents.setZoomFactor(clampZoom(current - ZOOM_STEP));
      event.preventDefault();
    } else if (input.key === "0") {
      window.webContents.setZoomFactor(1);
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  return window;
}
