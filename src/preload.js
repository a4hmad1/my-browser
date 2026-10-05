const { contextBridge, ipcRenderer } = require("electron");
async function call(name, data) {
  const result = await ipcRenderer.invoke(name, data);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
function listen(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
contextBridge.exposeInMainWorld("cinemaApi", {
  getSiteIcon: (url) => call("site-icon", url),
  verifyTelegram: (data) => call("account-verify-telegram", data),
  linkTelegram: (data) => call("account-telegram-link", data),
  openTelegram: () => call("open-telegram"),
  getCatalog: () => call("get-catalog"),
  clearCache: () => call("clear-cache"),
  clearHistory: () => call("clear-history"),
  exportBackup: (data) => call("export-backup", data),
  importBackup: () => call("import-backup"),
  getBlockStats: () => call("get-block-stats"),
  getProxy: () => call("get-proxy"),
  setProxy: (data) => call("set-proxy", data),
  getNetworkInfo: () => call("get-network-info"),
  checkPublicIp: () => call("check-public-ip"),
  getAccount: () => call("account-state"),
  login: (data) => call("account-login", data),
  register: (data) => call("account-register", data),
  resetPassword: (data) => call("account-reset", data),
  logout: () => call("account-logout"),
  activate: (data) => call("account-activate", data),
  addSite: (data) => call("account-add-site", data),
  favorite: (data) => call("account-favorite", data),
  removeSite: (id) => call("account-remove-site", id),
  openAccount: () => call("open-account"),
  navigate: (url) => call("navigate", url),
  tabAction: (data) => call("tab-action", data),
  onBlockEvent: (callback) => listen("ad-blocked", callback),
  onLocked: (callback) => listen("account-locked", callback),
  onNavigationError: (callback) => listen("navigation-error", callback),
  onDownloadComplete: (callback) => listen("download-complete", callback),
  onShortcut: (callback) => listen("browser-shortcut", callback),
  onHtmlFullscreen: (callback) => listen("html-fullscreen", callback),
  verifyActivationCode: (code) => call("verify-activation-code", code),
  checkForUpdates: () => call("check-for-updates"),
  downloadUpdate: (data) => call("download-update", data),
  installUpdate: () => call("install-update"),
  onUpdateAvailable: (callback) => listen("update-available", callback),
  onUpdateProgress: (callback) => listen("update-progress", callback),
  onUpdateDownloaded: (callback) => listen("update-downloaded", callback),
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  toggleFullscreen: () => ipcRenderer.send("window-fullscreen"),
});

