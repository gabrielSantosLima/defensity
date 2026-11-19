import path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  Notification,
  safeStorage,
  Tray,
  type MenuItemConstructorOptions,
} from "electron";
import type { RunUpdate } from "../shared/types";
import { registerIpc } from "./ipc";
import type { AppUseCases } from "./ipc/context";
import { createAgentService } from "./services/agentService";
import { systemClock, systemIds } from "./services/clock";
import { openDatabase } from "./services/db/database";
import { fileService } from "./services/fileService";
import { createFindingService } from "./services/findingService";
import { createHypothesisService } from "./services/hypothesisService";
import { createProviderService } from "./services/providerService";
import { createRunService } from "./services/runService";
import { createSandboxService } from "./services/sandboxService";
import { createSecretService, type Cipher } from "./services/secretService";
import { createSettingsService } from "./services/settingsService";
import { createWorkspaceService } from "./services/workspaceService";
import { ClearProviderKeyUseCase } from "./useCases/providers/clearProviderKey";
import { ListModelsUseCase } from "./useCases/providers/listModels";
import { SetProviderKeyUseCase } from "./useCases/providers/setProviderKey";
import { CancelRunUseCase } from "./useCases/runs/cancelRun";
import { FinishRunUseCase } from "./useCases/runs/finishRun";
import { GetRunUseCase } from "./useCases/runs/getRun";
import { GenerateReportUseCase } from "./useCases/runs/generateReport";
import { ListFindingsUseCase } from "./useCases/runs/listFindings";
import { ListWorkspaceIssuesUseCase } from "./useCases/runs/listWorkspaceIssues";
import { ListHypothesesUseCase } from "./useCases/runs/listHypotheses";
import { ListRunEventsUseCase } from "./useCases/runs/listRunEvents";
import { ListRunsUseCase } from "./useCases/runs/listRuns";
import { RecordRunEventUseCase } from "./useCases/runs/recordRunEvent";
import { RecoverRunsUseCase } from "./useCases/runs/recoverRuns";
import { ClearRunHistoryUseCase } from "./useCases/runs/clearRunHistory";
import { RerunRunUseCase } from "./useCases/runs/rerunRun";
import { StartRunUseCase } from "./useCases/runs/startRun";
import { BuildSandboxImagesUseCase } from "./useCases/sandbox/buildSandboxImages";
import { GetSandboxStatusUseCase } from "./useCases/sandbox/getSandboxStatus";
import { GetSettingsUseCase } from "./useCases/settings/getSettings";
import { SaveEngineSettingsUseCase } from "./useCases/settings/saveEngineSettings";
import { ArchiveWorkspaceUseCase } from "./useCases/workspaces/archiveWorkspace";
import { DeleteWorkspaceUseCase } from "./useCases/workspaces/deleteWorkspace";
import { UpdateWorkspaceUseCase } from "./useCases/workspaces/updateWorkspace";
import { CreateWorkspaceUseCase } from "./useCases/workspaces/createWorkspace";
import { GetWorkspaceUseCase } from "./useCases/workspaces/getWorkspace";
import { ListWorkspacesUseCase } from "./useCases/workspaces/listWorkspaces";
import { createMainWindow } from "./window";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

function broadcast(update: RunUpdate): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("run:update", update);
  }
}

function compose(userData: string): {
  useCases: AppUseCases;
  activeRunsLabel: () => string;
  dispose: () => void;
} {
  const database = openDatabase(path.join(userData, "defensity.db"));

  const cipher: Cipher = {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value).toString("base64"),
    decrypt: (value) =>
      safeStorage.decryptString(Buffer.from(value, "base64")),
  };

  const workspaces = createWorkspaceService(database);
  const settingsService = createSettingsService(database);
  const runs = createRunService(database);
  const secrets = createSecretService(
    path.join(userData, "secrets.json"),
    cipher,
  );
  const providers = createProviderService();
  const sandbox = createSandboxService({
    dockerRoot: app.isPackaged
      ? path.join(process.resourcesPath, "docker")
      : path.join(app.getAppPath(), "docker"),
    dockerHost: () => settingsService.get().dockerHost,
  });
  const hypotheses = createHypothesisService(database);
  const findings = createFindingService(database);

  const recordRunEvent = new RecordRunEventUseCase({
    runs,
    hypotheses,
    findings,
    clock: systemClock,
    ids: systemIds,
  });
  const finishRun = new FinishRunUseCase({
    runs,
    clock: systemClock,
    ids: systemIds,
  });

  function notifyRunFinished(
    runId: string,
    status: "completed" | "failed" | "cancelled",
    error?: string,
  ): void {
    if (!Notification.isSupported()) {
      return;
    }
    if (BrowserWindow.getAllWindows().some((window) => window.isFocused())) {
      return;
    }
    const run = runs.get(runId);
    const workspace = run ? workspaces.get(run.workspaceId) : null;
    const notification = new Notification({
      title: `defensity · ${status}`,
      body: `${workspace?.name ?? "Run"}${error ? ` — ${error}` : ""}`,
      icon: path.join(__dirname, "../../../build/icon.png"),
    });
    notification.on("click", focusExistingWindow);
    notification.show();
  }

  const agent = createAgentService({
    onEvent: (runId, type, payload) => {
      broadcast(recordRunEvent.execute({ runId, type, payload }));
    },
    onDelta: (runId, text) => {
      broadcast({ runId, type: "assistant.delta", text });
    },
    onFinish: (runId, status, error, steps) => {
      broadcast(finishRun.execute({ runId, status, error, steps }));
      notifyRunFinished(runId, status, error);
    },
  });

  const startRun = new StartRunUseCase({
    workspaces,
    runs,
    secrets,
    settings: settingsService,
    agent,
    sandbox,
    hypotheses,
    findings,
    clock: systemClock,
    ids: systemIds,
  });

  const useCases: AppUseCases = {
    listWorkspaces: new ListWorkspacesUseCase(workspaces),
    getWorkspace: new GetWorkspaceUseCase(workspaces),
    createWorkspace: new CreateWorkspaceUseCase({
      workspaces,
      files: fileService,
      clock: systemClock,
      ids: systemIds,
    }),
    archiveWorkspace: new ArchiveWorkspaceUseCase({
      workspaces,
      clock: systemClock,
    }),
    updateWorkspace: new UpdateWorkspaceUseCase({
      workspaces,
      files: fileService,
      clock: systemClock,
      ids: systemIds,
    }),
    deleteWorkspace: new DeleteWorkspaceUseCase(workspaces),
    getSettings: new GetSettingsUseCase({
      settings: settingsService,
      secrets,
    }),
    saveSettings: new SaveEngineSettingsUseCase(settingsService),
    setProviderKey: new SetProviderKeyUseCase(secrets),
    clearProviderKey: new ClearProviderKeyUseCase(secrets),
    listModels: new ListModelsUseCase({
      providers,
      secrets,
      settings: settingsService,
    }),
    startRun,
    rerunRun: new RerunRunUseCase({ runs, startRun }),
    cancelRun: new CancelRunUseCase({ runs, agent }),
    clearRunHistory: new ClearRunHistoryUseCase(runs),
    getRun: new GetRunUseCase(runs),
    listRuns: new ListRunsUseCase(runs),
    listRunEvents: new ListRunEventsUseCase(runs),
    listHypotheses: new ListHypothesesUseCase(hypotheses),
    listFindings: new ListFindingsUseCase(findings),
    listWorkspaceIssues: new ListWorkspaceIssuesUseCase(findings),
    generateReport: new GenerateReportUseCase({
      runs,
      workspaces,
      findings,
      hypotheses,
    }),
    getSandboxStatus: new GetSandboxStatusUseCase(sandbox),
    buildSandboxImages: new BuildSandboxImagesUseCase(sandbox),
  };

  new RecoverRunsUseCase({
    runs,
    clock: systemClock,
    ids: systemIds,
  }).execute();

  return {
    useCases,
    activeRunsLabel: () => {
      const active = runs.listActive();
      if (active.length === 0) {
        return "No active runs";
      }
      if (active.length > 1) {
        return `${active.length} active runs`;
      }
      const [run] = active;
      const workspace = workspaces.get(run.workspaceId);
      return `${workspace?.name ?? "Run"} · ${run.status}`;
    },
    dispose: () => agent.dispose(),
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
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", focusExistingWindow);

  let tray: Tray | null = null;
  let quitting = false;

  app.on("before-quit", () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    app.setAppUserModelId("com.defensity.app");

    if (process.platform !== "darwin") {
      Menu.setApplicationMenu(null);
    }

    const composed = compose(app.getPath("userData"));
    registerIpc(composed.useCases);

    function buildTrayMenu(): Menu {
      const template: MenuItemConstructorOptions[] = [
        { label: "Open defensity", click: focusExistingWindow },
        { label: composed.activeRunsLabel(), enabled: false },
        { type: "separator" },
        {
          label: "Quit defensity",
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ];
      return Menu.buildFromTemplate(template);
    }

    function createTray(): void {
      try {
        tray = new Tray(path.join(__dirname, "../../../build/icon.png"));
      } catch {
        // Without a tray icon, closing must quit so the app is not lost.
        tray = null;
        return;
      }
      tray.setToolTip("defensity");
      tray.setContextMenu(buildTrayMenu());
      tray.on("click", focusExistingWindow);
      tray.on("double-click", focusExistingWindow);

      const timer = setInterval(() => {
        if (!tray) {
          return;
        }
        tray.setToolTip(`defensity · ${composed.activeRunsLabel()}`);
        tray.setContextMenu(buildTrayMenu());
      }, 10000);
      timer.unref();
    }

    function openMainWindow(): BrowserWindow {
      const window = createMainWindow(devServerUrl);
      window.on("close", (event) => {
        if (quitting) {
          return;
        }
        let closeToTray = true;
        try {
          closeToTray = composed.useCases.getSettings.execute().closeToTray;
        } catch {
          closeToTray = true;
        }
        if (tray && closeToTray) {
          event.preventDefault();
          window.hide();
        }
      });
      return window;
    }

    createTray();
    openMainWindow();

    app.on("will-quit", () => {
      tray?.destroy();
      tray = null;
      composed.dispose();
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        openMainWindow();
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
