// preload.js — the ONLY bridge between a loaded page and Electron/Node.
// Runs on EVERY page this window loads, including the real remote server
// once one is configured — so this must expose nothing beyond the two
// narrow, harmless calls the local setup.html screen needs. A page hosted
// by the actual CamPOS Fashion server never calls these (it doesn't know
// they exist), but they'd be harmless even if it tried: saving a server
// URL and reading the current one, nothing that touches files, processes,
// or any other Node API.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  saveServerUrl: (url) => ipcRenderer.invoke('desktop:save-server-url', url),
  getServerUrl: () => ipcRenderer.invoke('desktop:get-server-url'),
});
