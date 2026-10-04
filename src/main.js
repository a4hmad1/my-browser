const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  safeStorage,
  shell,
  dialog,
  Menu,
} = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("node:net");
const os = require("node:os");
const { pathToFileURL } = require("url");
const { ElectronBlocker } = require("@cliqz/adblocker-electron");
const fetch = require("cross-fetch");
const { publicHttps, blocked, inCatalog } = require("./security");
const { allowedPage, resolveInput } = require("./browser-url");
const { createBackup, parseBackup, MAX_BYTES } = require("./backup");
const rules = require("./adblock/rules");
const config = require("./config.json");
if (!app.isPackaged && process.env.CINEMA_PROFILE_DIR)
  app.setPath("userData", process.env.CINEMA_PROFILE_DIR);
app.commandLine.appendSwitch("disable-http-cache");
if (process.platform === "linux") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-features", "Vulkan");
  if (process.env.DISPLAY)
    app.commandLine.appendSwitch("ozone-platform", "x11");
}
let mainWindow,
  movieSession,
  token = null,
  account = null,
  sites = [],
  checkedAt = 0,
  telegramUrl = null;
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
const stats = { adsBlocked: 0, popupsBlocked: 0 };
const guests = new Set();
let proxyMode = "system";
let torPort = 9050;
let onionProxy = false;
function isOnion(raw) {
  try { return new URL(raw).hostname.toLowerCase().endsWith(".onion"); }
  catch { return false; }
}
function checkLocalSocks(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let finished = false;
    const done = (error) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      error ? reject(new Error("No Tor SOCKS5 service responded on 127.0.0.1:" + port + ". Start Tor or Tor Browser, then try again.")) : resolve();
    };
    socket.setTimeout(2000, () => done(true));
    socket.on("error", () => done(true));
    socket.on("connect", () => socket.write(Buffer.from([5, 1, 0])));
    let reply = Buffer.alloc(0);
    socket.on("data", (data) => {
      reply = Buffer.concat([reply, data]);
      if (reply.length >= 2) done(reply[0] !== 5 || reply[1] !== 0);
    });
    socket.on("end", () => done(true));
  });
}
const shellUrl = pathToFileURL(
  path.join(__dirname, "renderer", "index.html"),
).href;
const userScript = fs.readFileSync(
  path.join(__dirname, "adblock", "userScript.js"),
  "utf8",
);
const configuredApiBase = app.isPackaged
  ? config.apiBase
  : process.env.CINEMA_API_URL || config.apiBase;
const apiBase = (() => {
  try {
    const base = new URL(configuredApiBase);
    if (base.protocol === "https:") return base.origin;
    if ((!app.isPackaged || config.developmentBuild) && base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname))
      return base.origin;
  } catch {}
  return null;
})();
function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send(channel, data);
}
function count(type) {
  stats[type]++;
  send("ad-blocked", stats);
}
function tokenPath() {
  return path.join(app.getPath("userData"), "account.bin");
}
function saveToken(value) {
  token = value;
  if (!value) {
    try {
      fs.unlinkSync(tokenPath());
    } catch {}
    return;
  }
  // On Linux, refuse the basic_text fallback: keep credentials only in memory.
  if (
    safeStorage.isEncryptionAvailable() &&
    !(
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    )
  )
    fs.writeFileSync(tokenPath(), safeStorage.encryptString(value), {
      mode: 0o600,
    });
}
function loadToken() {
  try {
    if (safeStorage.isEncryptionAvailable() && !(process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text"))
      token = safeStorage.decryptString(fs.readFileSync(tokenPath()));
  } catch {}
}
async function api(route, method = "GET", data) {
  if (!apiBase) throw new Error("Account service is not configured for this build.");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(apiBase + "/api" + route, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await res
      .json()
      .catch(() => ({
        message: "The account server returned an invalid response.",
      }));
    if (!res.ok) {
      if (res.status === 401) {
        saveToken(null);
        lock();
      }
      throw new Error(
        Object.values(body.errors || {})
          .flat()
          .join(" ") ||
          body.message ||
          "Request failed.",
      );
    }
    return body;
  } catch (err) {
    if (err.name === "AbortError" || err.name === "TimeoutError")
      throw new Error("The account server timed out. Try again.");
    if (err.name === "FetchError" || err instanceof TypeError)
      throw new Error("Cannot reach the account server. Check your internet connection and try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
function lock() {
  account = null;
  sites = [];
  checkedAt = 0;
  send("account-locked", {});
}
async function refresh() {
  if (!token) {
    lock();
    return { user: null, access: null };
  }
  try {
    const result = await api("/account");
    if (account?.access?.custom_site_limit !== result.access.custom_site_limit) sites = [];
    result.telegram_url = telegramUrl;
    account = result;
    checkedAt = Date.now();
    if (!result.access.active) {
      sites = [];
      send("account-locked", result);
    }
    return result;
  } catch (err) {
    // A temporary network failure must not erase a valid login. The API
    // handler already clears the token and locks the browser on HTTP 401.
    if (!token) lock();
    throw err;
  }
}
async function entitled() {
  if (Date.now() - checkedAt > 15000) await refresh();
  if (
    !account?.access.active ||
    new Date(account.access.ends_at).getTime() <= Date.now()
  )
    throw new Error(
      "Your membership has ended or is suspended. Activate a plan to continue.",
    );
}
async function catalog() {
  await entitled();
  const result = await api("/catalog");
  sites = result.sites;
  return result;
}
async function navigate(data) {
  const target = resolveInput(data?.url, data?.searchEngine);
  if (isOnion(target) && !onionProxy)
    throw new Error("A .onion site needs a Tor SOCKS5 connection. Enable Tor in Settings & VPN first.");
  const contents = [...guests].find((item) => item.id === data?.id && !item.isDestroyed());
  if (!contents) throw new Error("This tab is not ready. Try again.");
  contents.loadURL(target).catch((error) => {
    if (!/ERR_ABORTED/.test(error.message))
      send("navigation-error", "This website could not load: " + error.message);
  });
  return { url: target };
}
function configureSession() {
  movieSession = session.fromPartition("cinema-private", { cache: false });
  movieSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission === "fullscreen") return callback(true);
    if (!["media", "geolocation", "notifications", "clipboard-read"].includes(permission)) return callback(false);
    let origin;
    try { origin = new URL(details.requestingUrl || contents.getURL()).origin; }
    catch { return callback(false); }
    dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Block", "Allow"],
      defaultId: 0,
      cancelId: 0,
      message: `${origin} requests ${permission} access`,
      detail: "Allow this permission for the current request?",
    }).then(({ response }) => callback(response === 1)).catch(() => callback(false));
  });
  movieSession.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "Save download",
      defaultPath: path.join(app.getPath("downloads"), path.basename(item.getFilename() || "download")),
    });
    item.on("done", (_doneEvent, state) => {
      if (state === "completed") send("download-complete", item.getSavePath());
    });
  });
  let blocker = ElectronBlocker.parse(
    rules.blockedDomains.map((d) => "||" + d + "^").join("\n"),
  );
  function attach(engine) {
    if (blocker.isBlockingEnabled(movieSession))
      blocker.disableBlockingInSession(movieSession);
    blocker = engine;
    blocker.enableBlockingInSession(movieSession);
    // Electron accepts one request listener. Compose our rules and EasyList in this listener.
    movieSession.webRequest.onBeforeRequest(
      { urls: ["<all_urls>"] },
      (details, callback) => {
        if (details.url === "about:blank") return callback({});
        let url;
        try {
          url = new URL(details.url);
        } catch {
          return callback({ cancel: true });
        }
        if (["file:", "javascript:", "ftp:"].includes(url.protocol))
          return callback({ cancel: true });
        if (details.resourceType === "mainFrame" && !allowedPage(details.url))
          return callback({ cancel: true });
        if (isOnion(details.url) && !onionProxy)
          return callback({ cancel: true });
        if (details.resourceType === "mainFrame") return callback({});
        if (blocked(details.url)) {
          count("adsBlocked");
          return callback({ cancel: true });
        }
        blocker.onBeforeRequest(details, (result) => {
          if (result.cancel || result.redirectURL) count("adsBlocked");
          callback(result);
        });
      },
    );
  }
  attach(blocker);
  const timedFetch = (url, options = {}) =>
    fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  ElectronBlocker.fromPrebuiltAdsAndTracking(timedFetch)
    .then(attach)
    .catch((err) =>
      send("shield-status", {
        message: "Built-in filters active; online filter update unavailable.",
      }),
    );
}
function trusted(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame?.url !== shellUrl
  )
    throw new Error("Untrusted caller.");
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    trusted(event);
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
handle("account-state", refresh);
handle("account-login", async (data) => {
  const result = await api("/login", "POST", data);
  saveToken(result.token);
  telegramUrl = result.telegram_url || null;
  return refresh();
});
handle("account-register", async (data) => {
  const result = await api("/register", "POST", data);
  saveToken(result.token);
  telegramUrl = result.telegram_url || null;
  return refresh();
});
handle("account-verify-telegram", async (data) => {
  await api('/telegram/verify', 'POST', data);
  telegramUrl = null;
  return refresh();
});
handle("account-telegram-link", async (data) => {
  const result = await api('/telegram/link', 'POST', data);
  if (!/^https:\/\/t\.me\/[a-z0-9_]+(?:\?start=[a-f0-9]{48})?$/i.test(result.url || ''))
    throw new Error('The account server returned an invalid Telegram link.');
  telegramUrl = result.url;
  await shell.openExternal(result.url);
  return result;
});
handle("open-telegram", async () => {
  let url = telegramUrl;
  if (!url && account?.access.telegram_linked && /^[a-z0-9_]{5,32}$/i.test(account.telegram_bot || ''))
    url = 'https://t.me/' + account.telegram_bot;
  if (!url || !/^https:\/\/t\.me\/[a-z0-9_]+(?:\?start=[a-f0-9]{48})?$/i.test(url))
    throw new Error('Generate a fresh Telegram link from your account dashboard.');
  await shell.openExternal(url);
  return {};
});
const faviconCache = new Map();
const faviconRequests = new Map();
handle("site-icon", async (url) => {
  if (!allowedPage(url)) throw new Error("Invalid website.");
  // This lookup runs outside Chromium's proxy, so avoid leaking Tor and
  // private website names to the favicon provider.
  if (proxyMode === "tor" || isOnion(url) || !publicHttps(url)) return null;
  const cached = faviconCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.image;
  if (faviconRequests.has(url)) return faviconRequests.get(url);
  const request = (async () => {
    const iconUrl = 'https://www.google.com/s2/favicons?sz=128&domain_url=' + encodeURIComponent(new URL(url).origin);
    let image = null;
    try {
      const response = await fetch(iconUrl, { signal: AbortSignal.timeout(8000), size: 131072 });
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (response.ok && ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg', 'image/webp'].includes(type)) {
        const buffer = await response.buffer();
        if (buffer.length > 0 && buffer.length <= 131072)
          image = 'data:' + type + ';base64,' + buffer.toString('base64');
      }
    } catch {}
    faviconCache.set(url, { image, expires: Date.now() + (image ? 60 * 60 * 1000 : 5 * 60 * 1000) });
    return image;
  })();
  faviconRequests.set(url, request);
  try { return await request; }
  finally { faviconRequests.delete(url); }
});
handle("account-reset", (data) => api("/reset-password", "POST", data));
handle("account-logout", async () => {
  try {
    if (token) await api("/logout", "POST");
  } finally {
    saveToken(null);
    telegramUrl = null;
    faviconCache.clear();
    faviconRequests.clear();
    lock();
    // Signing out of an optional account does not erase browsing tabs or site logins.
  }
  return {};
});
handle("account-activate", async (data) => {
  await api("/subscription/activate", "POST", data);
  return refresh();
});
handle("account-add-site", async (data) => {
  await api("/sites", "POST", data);
  return catalog();
});
handle("account-favorite", async (data) => {
  if (!Number.isInteger(data.id)) throw new Error("Invalid site.");
  await api("/sites/" + data.id, "PATCH", { favorite: Boolean(data.favorite) });
  return catalog();
});
handle("account-remove-site", async (id) => {
  if (!Number.isInteger(id)) throw new Error("Invalid site.");
  await api("/sites/" + id, "DELETE");
  return catalog();
});
handle("get-catalog", catalog);
handle("navigate", navigate);
handle("tab-action", ({ id, action }) => {
  const contents = [...guests].find((item) => item.id === id && !item.isDestroyed());
  if (!contents) throw new Error("Tab is unavailable.");
  if (action === "back" && contents.navigationHistory.canGoBack()) contents.navigationHistory.goToIndex(contents.navigationHistory.getActiveIndex() - 1);
  else if (action === "forward" && contents.navigationHistory.canGoForward()) contents.navigationHistory.goToIndex(contents.navigationHistory.getActiveIndex() + 1);
  else if (action === "reload") contents.reloadIgnoringCache();
  else if (!["back", "forward", "reload"].includes(action)) throw new Error("Invalid tab action.");
  return {};
});
handle("open-account", async () => {
  if (!apiBase) throw new Error("Account service is not configured for this build.");
  await shell.openExternal(apiBase + "/dashboard");
  return {};
});
handle("clear-cache", async () => {
  await movieSession.clearCache();
  await movieSession.clearStorageData();
  return { success: true, message: "Temporary website data cleared." };
});
handle("clear-history", () => {
  for (const contents of guests)
    if (!contents.isDestroyed()) contents.navigationHistory.clear();
  return {};
});
handle("export-backup", async (data) => {
  const backup = createBackup(data);
  const filename = `CineStream-Backup-${new Date().toISOString().slice(0, 10)}.json`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Back up browser data",
    defaultPath: path.join(app.getPath("downloads"), filename),
    filters: [{ name: "Browser backup", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  await fs.promises.writeFile(filePath, backup, { mode: 0o600 });
  return { canceled: false };
});
handle("import-backup", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Restore browser data",
    properties: ["openFile"],
    filters: [{ name: "Browser backup", extensions: ["json"] }],
  });
  if (canceled || !filePaths?.length) return { canceled: true };
  const stat = await fs.promises.stat(filePaths[0]);
  if (stat.size > MAX_BYTES) throw new Error("The backup file is too large.");
  const backup = parseBackup(await fs.promises.readFile(filePaths[0], "utf8"));
  return { canceled: false, ...backup };
});
handle("get-block-stats", () => stats);
handle("get-network-info", () => {
  const local = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces()))
    for (const address of addresses || [])
      if (!address.internal && net.isIP(address.address))
        local.push({ interface: name, address: address.address, family: address.family });
  return { local, mode: proxyMode };
});
handle("check-public-ip", async () => {
  try {
    const response = await movieSession.fetch("https://api64.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("IP service unavailable.");
    const body = await response.json();
    if (typeof body.ip !== "string" || !net.isIP(body.ip)) throw new Error("IP service returned invalid data.");
    return { ip: body.ip, mode: proxyMode };
  } catch {
    throw new Error("Could not check the public IP through this browser connection.");
  }
});
handle("get-proxy", () => ({ mode: proxyMode, torPort }));
handle("set-proxy", async (data) => {
  if (data?.mode === "system" || data?.mode === "direct") {
    await movieSession.setProxy({ mode: data.mode });
    proxyMode = data.mode;
    onionProxy = false;
  } else if (data?.mode === "tor") {
    const port = Number(data.torPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Enter a valid Tor SOCKS port.");
    await checkLocalSocks(port);
    await movieSession.setProxy({ mode: "fixed_servers", proxyRules: `socks5://127.0.0.1:${port}` });
    torPort = port;
    proxyMode = "tor";
    onionProxy = true;
  } else if (data?.mode === "manual") {
    const host = String(data.host || "").trim();
    const port = Number(data.port);
    if (!/^[a-z0-9.-]+$/i.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !["http", "socks5"].includes(data.type))
      throw new Error("Enter a valid proxy host, port and type.");
    await movieSession.setProxy({ mode: "fixed_servers", proxyRules: `${data.type}://${host}:${port}` });
    proxyMode = "manual";
    onionProxy = data.type === "socks5";
  } else throw new Error("Invalid proxy mode.");
  await movieSession.closeAllConnections();
  return { mode: proxyMode, torPort };
});
for (const channel of [
  "window-minimize",
  "window-maximize",
  "window-close",
  "window-fullscreen",
])
  ipcMain.on(channel, (event) => {
    trusted(event);
    if (channel === "window-minimize") mainWindow.minimize();
    if (channel === "window-maximize")
      mainWindow.isMaximized()
        ? mainWindow.unmaximize()
        : mainWindow.maximize();
    if (channel === "window-close") mainWindow.close();
    if (channel === "window-fullscreen")
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 760,
    minHeight: 540,
    autoHideMenuBar: true,
    title: "CineStream Browser",
    backgroundColor: "#090a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== shellUrl) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event, prefs, params) => {
    if (params.src !== "about:blank" || params.partition !== "cinema-private") {
      event.preventDefault();
      return;
    }
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webSecurity = true;
    prefs.allowRunningInsecureContent = false;
  });
  mainWindow.webContents.on("did-attach-webview", (_event, contents) => {
    guests.add(contents);
    contents.on("destroyed", () => guests.delete(contents));
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      const key = input.key.toLowerCase();
      const ctrl = input.control || input.meta;
      const shift = input.shift;
      const alt = input.alt;
      const code = input.code;

      let shortcut = null;
      if (ctrl && !shift && key === "t") shortcut = "new-tab";
      else if (ctrl && shift && key === "t") shortcut = "reopen-closed-tab";
      else if (ctrl && !shift && (key === "w" || key === "f4")) shortcut = "close-tab";
      else if ((ctrl && !shift && (key === "tab" || code === "PageDown")) || (alt && ctrl && key === "arrowright")) shortcut = "next-tab";
      else if ((ctrl && shift && (key === "tab" || code === "PageUp")) || (alt && ctrl && key === "arrowleft")) shortcut = "prev-tab";
      else if (ctrl && !shift && key >= "1" && key <= "8") shortcut = "switch-tab-" + key;
      else if (ctrl && !shift && key === "9") shortcut = "last-tab";
      else if (ctrl && !shift && key === "n") shortcut = "new-tab";

      else if ((ctrl && key === "l") || (alt && key === "d") || key === "f6") shortcut = "address";
      else if ((ctrl && shift && key === "r") || (ctrl && key === "f5")) shortcut = "hard-reload";
      else if ((ctrl && !shift && key === "r") || key === "f5") shortcut = "reload";
      else if (alt && key === "arrowleft") shortcut = "back";
      else if (alt && key === "arrowright") shortcut = "forward";
      else if (alt && key === "home") shortcut = "home";

      else if (ctrl && !shift && key === "d") shortcut = "toggle-bookmark";
      else if (ctrl && (shift && key === "d" || !shift && key === "b" || shift && key === "o")) shortcut = "bookmarks-panel";
      else if (ctrl && !shift && (key === "h" || key === "y")) shortcut = "history-panel";
      else if (ctrl && !shift && key === "j") shortcut = "downloads-panel";
      else if (ctrl && shift && (key === "delete" || code === "Delete")) shortcut = "clear-data";

      else if (ctrl && (key === "=" || key === "+" || code === "NumpadAdd" || code === "Equal")) shortcut = "zoom-in";
      else if (ctrl && (key === "-" || code === "NumpadSubtract" || code === "Minus")) shortcut = "zoom-out";
      else if (ctrl && (key === "0" || code === "Numpad0" || code === "Digit0")) shortcut = "zoom-reset";

      else if (ctrl && !shift && key === "f") shortcut = "find-in-page";
      else if (key === "f3") shortcut = shift ? "find-prev" : "find-next";
      else if (key === "escape") shortcut = "escape";

      else if (key === "f11") shortcut = "fullscreen";
      else if (key === "f12" || (ctrl && shift && (key === "i" || key === "j"))) shortcut = "devtools";
      else if (ctrl && !shift && key === "p") shortcut = "print";
      else if (ctrl && !shift && key === "u") shortcut = "view-source";

      if (shortcut) {
        event.preventDefault();
        send("browser-shortcut", shortcut);
      }
    });
    contents.setWindowOpenHandler(() => {
      count("popupsBlocked");
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      if (!allowedPage(url) || (isOnion(url) && !onionProxy)) {
        event.preventDefault();
        if (isOnion(url)) send("navigation-error", "Enable a Tor SOCKS5 connection in Settings & VPN to open .onion sites.");
      }
    });
    contents.on("will-redirect", (event, url) => {
      if (!allowedPage(url) || (isOnion(url) && !onionProxy)) {
        event.preventDefault();
        if (isOnion(url)) send("navigation-error", "Enable a Tor SOCKS5 connection in Settings & VPN to open .onion sites.");
      }
    });
    contents.on("render-process-gone", () => {
      send("navigation-error", "This page stopped responding. Reload its tab.");
    });
    contents.on("dom-ready", () => {
      contents.insertCSS(rules.antiAdCss).catch(() => {});
      contents.executeJavaScript(userScript).catch(() => {});
    });
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.loadURL(shellUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
    guests.clear();
  });
}
app.whenReady().then(() => {
  const menuTemplate = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => send("browser-shortcut", "reload"),
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => send("browser-shortcut", "hard-reload"),
        },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => send("browser-shortcut", "zoom-reset"),
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => send("browser-shortcut", "zoom-in"),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => send("browser-shortcut", "zoom-out"),
        },
        { type: "separator" },
        {
          label: "Toggle Fullscreen",
          accelerator: "F11",
          click: () => send("browser-shortcut", "fullscreen"),
        },
      ],
    },
    {
      label: "History",
      submenu: [
        {
          label: "Back",
          accelerator: "Alt+Left",
          click: () => send("browser-shortcut", "back"),
        },
        {
          label: "Forward",
          accelerator: "Alt+Right",
          click: () => send("browser-shortcut", "forward"),
        },
        {
          label: "Show Full History",
          accelerator: "CmdOrCtrl+H",
          click: () => send("browser-shortcut", "history-panel"),
        },
        {
          label: "Reopen Closed Tab",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => send("browser-shortcut", "reopen-closed-tab"),
        },
      ],
    },
    {
      label: "Bookmarks",
      submenu: [
        {
          label: "Bookmark This Tab",
          accelerator: "CmdOrCtrl+D",
          click: () => send("browser-shortcut", "toggle-bookmark"),
        },
        {
          label: "Show Bookmarks",
          accelerator: "CmdOrCtrl+B",
          click: () => send("browser-shortcut", "bookmarks-panel"),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => send("browser-shortcut", "new-tab"),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => send("browser-shortcut", "close-tab"),
        },
        { role: "minimize" },
        { role: "close" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  loadToken();
  configureSession();
  createWindow();
  const timer = setInterval(() => {
    if (token) refresh().catch(() => {});
  }, 15000);
  timer.unref();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => app.quit());
