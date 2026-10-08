import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  ipc: {
    invoke: (channel: string, ...args: any[]) => {
      const validChannels = ["app:version", "app:quit"];

      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }

      throw new Error(`Invalid IPC channel: ${channel}`);
    },
  },
});
