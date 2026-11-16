import path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  Notification,
  safeStorage,
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
import { StartRunUseCase } from "./useCases/runs/startRun";
import { GetSettingsUseCase } from "./useCases/settings/getSettings";
import { SaveEngineSettingsUseCase } from "./useCases/settings/saveEngineSettings";
import { ArchiveWorkspaceUseCase } from "./useCases/workspaces/archiveWorkspace";
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
  const sandbox = createSandboxService();
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
    startRun: new StartRunUseCase({
      workspaces,
      runs,
      secrets,
      settings: settingsService,
      agent,
      sandbox,
      clock: systemClock,
      ids: systemIds,
    }),
    cancelRun: new CancelRunUseCase({ runs, agent }),
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
  };

  new RecoverRunsUseCase({
    runs,
    clock: systemClock,
    ids: systemIds,
  }).execute();

  return { useCases, dispose: () => agent.dispose() };
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

    const composed = compose(app.getPath("userData"));
    registerIpc(composed.useCases);
    createMainWindow(devServerUrl);
    app.on("will-quit", composed.dispose);

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
