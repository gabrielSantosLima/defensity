import { contextBridge, ipcRenderer } from "electron";
import type { DefensityApi } from "../shared/types";

const api: DefensityApi = {
  listWorkspaces: () => ipcRenderer.invoke("workspaces:list"),
  getWorkspace: (id) => ipcRenderer.invoke("workspaces:get", id),
  createWorkspace: (input) => ipcRenderer.invoke("workspaces:create", input),
  archiveWorkspace: (id) => ipcRenderer.invoke("workspaces:archive", id),
  pickPath: (options) => ipcRenderer.invoke("dialog:pickPath", options),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (patch) => ipcRenderer.invoke("settings:save", patch),
  listModels: (provider) => ipcRenderer.invoke("providers:listModels", provider),
  setProviderKey: (provider, key) =>
    ipcRenderer.invoke("secrets:set", provider, key),
  clearProviderKey: (provider) =>
    ipcRenderer.invoke("secrets:clear", provider),
};

contextBridge.exposeInMainWorld("defensity", api);
