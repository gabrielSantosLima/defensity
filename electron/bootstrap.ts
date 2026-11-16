import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  safeStorage,
} from "electron";
import { createWorkspaceRepository } from "./infrastructure/db/workspaceRepository";
import { createSettingsRepository } from "./infrastructure/db/settingsRepository";
import { openDatabase } from "./infrastructure/db/database";
import { fingerprintPath } from "./infrastructure/fs/fingerprint";
import {
  createSecretStore,
  type Cipher,
} from "./infrastructure/secrets/secretStore";
import { registerIpc } from "./ipc";
import type { IpcContext } from "./ipc/context";
import { createMainWindow } from "./window";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

function buildContext(userData: string): IpcContext {
  const database = openDatabase(path.join(userData, "defensity.db"));

  const cipher: Cipher = {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value).toString("base64"),
    decrypt: (value) =>
      safeStorage.decryptString(Buffer.from(value, "base64")),
  };

  return {
    workspaces: createWorkspaceRepository(database),
    settings: createSettingsRepository(database),
    secrets: createSecretStore(path.join(userData, "secrets.json"), cipher),
    fingerprint: fingerprintPath,
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
  };
}

function focusExistingWindow(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", focusExistingWindow);

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    app.setAppUserModelId("com.defensity.app");

    if (process.platform !== "darwin") {
      Menu.setApplicationMenu(null);
    }

    registerIpc(buildContext(app.getPath("userData")));
    createMainWindow(devServerUrl);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(devServerUrl);
      } else {
        focusExistingWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
