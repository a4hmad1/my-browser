const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  // Strip x-frame-options on defaultSession and all sessions
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    callback({ responseHeaders });
  });

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: { webviewTag: true }
  });

  win.loadURL('data:text/html,<style>body,html,webview{width:100%;height:100%;margin:0;padding:0;display:inline-flex;}</style><webview id="v" src="https://hdtoday.tv"></webview>');

  win.webContents.on('did-attach-webview', (e, wc) => {
    wc.on('did-fail-load', (ev, code, desc, url) => console.log('FAIL LOAD:', code, desc, url));
    wc.on('did-finish-load', () => console.log('SUCCESS FINISH LOAD HDTODAY! URL:', wc.getURL()));
    wc.on('console-message', (ev, level, msg) => console.log('WEBVIEW CONSOLE:', msg));
  });

  setTimeout(() => app.exit(0), 7000);
});
