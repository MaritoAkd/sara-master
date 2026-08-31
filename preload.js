const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sara", {
  ask: (text) => ipcRenderer.invoke("sara-ask", text),
  stats: () => ipcRenderer.invoke("sara-stats"),
  feed: () => ipcRenderer.invoke("sara-feed"),
  open: (url) => ipcRenderer.invoke("sara-open", url),
  article: (url) => ipcRenderer.invoke("sara-article", url),
  search: (q) => ipcRenderer.invoke("sara-search", q),
  onToken: (cb) => ipcRenderer.on("sara-token", (_e, d) => cb(d.text)),
  onAudio: (cb) => ipcRenderer.on("sara-audio", (_e, d) => cb(d)),
  onStatus: (cb) => ipcRenderer.on("sara-status", (_e, s) => cb(s)),
});
