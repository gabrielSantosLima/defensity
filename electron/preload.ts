import { contextBridge, ipcRenderer } from "electron";
import type { DefensityApi } from "../shared/types";

const api: DefensityApi = {
  listWorkspaces: () => ipcRenderer.invoke("workspaces:list"),
  getWorkspace: (id) => ipcRenderer.invoke("workspaces:get", id),
  createWorkspace: (input) => ipcRenderer.invoke("workspaces:create", input),
  archiveWorkspace: (id) => ipcRenderer.invoke("workspaces:archive", id),
  updateWorkspace: (id, input) =>
    ipcRenderer.invoke("workspaces:update", id, input),
  deleteWorkspace: (id) => ipcRenderer.invoke("workspaces:delete", id),
  clearRunHistory: (workspaceId) =>
    ipcRenderer.invoke("runs:clear", workspaceId),
  pickPath: (options) => ipcRenderer.invoke("dialog:pickPath", options),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (patch) => ipcRenderer.invoke("settings:save", patch),
  listModels: (provider) => ipcRenderer.invoke("providers:listModels", provider),
  startRun: (workspaceId) => ipcRenderer.invoke("runs:start", workspaceId),
  rerunRun: (runId) => ipcRenderer.invoke("runs:rerun", runId),
  zoomBy: (delta) => ipcRenderer.invoke("zoom:by", delta),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  cancelRun: (runId) => ipcRenderer.invoke("runs:cancel", runId),
  getRun: (runId) => ipcRenderer.invoke("runs:get", runId),
  listRuns: (workspaceId) => ipcRenderer.invoke("runs:list", workspaceId),
  listRunEvents: (runId) => ipcRenderer.invoke("runs:events", runId),
  listHypotheses: (runId) => ipcRenderer.invoke("runs:hypotheses", runId),
  listFindings: (runId) => ipcRenderer.invoke("runs:findings", runId),
  listWorkspaceIssues: (workspaceId) =>
    ipcRenderer.invoke("issues:list", workspaceId),
  generateReport: (runId) => ipcRenderer.invoke("reports:generate", runId),
  saveReport: (runId) => ipcRenderer.invoke("reports:save", runId),
  getSandboxStatus: () => ipcRenderer.invoke("sandbox:status"),
  buildSandboxImages: () => ipcRenderer.invoke("sandbox:build"),
  onSandboxProgress: (listener) => {
    const handler = (_event: unknown, chunk: unknown) =>
      listener(String(chunk ?? ""));
    ipcRenderer.on("sandbox:progress", handler);
    return () => {
      ipcRenderer.removeListener("sandbox:progress", handler);
    };
  },
  onRunUpdate: (listener) => {
    const handler = (_event: unknown, update: unknown) =>
      listener(update as never);
    ipcRenderer.on("run:update", handler);
    return () => {
      ipcRenderer.removeListener("run:update", handler);
    };
  },
  setProviderKey: (provider, key) =>
    ipcRenderer.invoke("secrets:set", provider, key),
  clearProviderKey: (provider) =>
    ipcRenderer.invoke("secrets:clear", provider),
};

contextBridge.exposeInMainWorld("defensity", api);
