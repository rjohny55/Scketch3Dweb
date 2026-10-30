const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scketch3dwebDesktop", {
  getVersion: () => ipcRenderer.invoke("scketch3dweb:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("scketch3dweb:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("scketch3dweb:install-update"),
});
