(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.cinemaApi;
  const defaults = [
    { title: 'Beenar (کوردی)', url: 'https://beenar.net' },
    { title: 'KurdSubtitle', url: 'https://kurdsubtitle.net' },
    { title: 'Kurdbin', url: 'https://kurdbin.kurdsat.tv' },
    { title: 'KurdViewer', url: 'https://kurdviewer.com' },
    { title: 'Tubi Cinema', url: 'https://tubitv.com' },
    { title: 'Pluto TV', url: 'https://pluto.tv' },
    { title: 'Plex Movies', url: 'https://watch.plex.tv/' },
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com/' },
  ];
  let bookmarks = [];
  try { bookmarks = JSON.parse(localStorage.getItem('browser-bookmarks') || '[]'); if (!Array.isArray(bookmarks)) bookmarks = []; }
  catch { bookmarks = []; }
  let searchEngine = localStorage.getItem('browser-search-engine') || 'duckduckgo';
  if (!['duckduckgo', 'brave'].includes(searchEngine)) {
    searchEngine = 'duckduckgo';
    localStorage.setItem('browser-search-engine', searchEngine);
  }
  const tabs = new Map();
  const history = [];
  let activeId = null;
  let nextId = 1;
  let accountMode = 'login';
  let account = null;
  let toastTimer;
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
  }
  function saveBookmarks() {
    localStorage.setItem('browser-bookmarks', JSON.stringify(bookmarks));
    renderQuickLinks();
    if (!$('side-panel').hidden && $('panel-title').textContent === 'Bookmarks') showPanel('bookmarks');
  }
  function current() { return tabs.get(activeId); }
  function currentUrl() { const tab = current(); return tab && tab.url !== 'about:blank' ? tab.url : ''; }
  function updateToolbar() {
    const tab = current();
    const url = currentUrl();
    if (document.activeElement !== $('url-input')) $('url-input').value = url;
    $('security-icon').textContent = !url ? '⌕' : url.startsWith('https:') ? '⌁' : 'ⓘ';
    $('security-icon').classList.toggle('insecure', !!url && url.startsWith('http:'));
    $('security-icon').title = !url ? 'New tab' : url.startsWith('https:') ? 'Secure connection' : 'HTTP connection is not encrypted';
    $('btn-bookmark').textContent = bookmarks.some((item) => item.url === url) ? '★' : '☆';
    $('btn-bookmark').classList.toggle('saved', bookmarks.some((item) => item.url === url));
    $('btn-bookmark').disabled = !url;
    $('btn-back').disabled = !tab?.ready || !tab.view.canGoBack();
    $('btn-forward').disabled = !tab?.ready || !tab.view.canGoForward();
    $('btn-reload').disabled = !url;
    $('start-page').hidden = !!url;
    $('error-page').hidden = !tab?.error || !url;
    if (tab?.error) $('error-text').textContent = tab.error;
    for (const item of tabs.values()) {
      item.button.classList.toggle('active', item.id === activeId);
      item.button.setAttribute('aria-selected', String(item.id === activeId));
      item.view.classList.toggle('active', item.id === activeId && !!url && !item.error);
    }
  }
  function activate(id) {
    if (!tabs.has(id)) return;
    activeId = id;
    updateToolbar();
  }
  function titleFor(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'New tab'; } }
  function createTab(url = '') {
    const id = nextId++;
    const button = document.createElement('div');
    button.className = 'tab';
    button.setAttribute('role', 'tab');
    button.tabIndex = 0;
    const icon = document.createElement('span'); icon.className = 'tab-icon'; icon.textContent = 'C';
    const title = document.createElement('span'); title.className = 'tab-title'; title.textContent = 'New tab';
    const close = document.createElement('button'); close.className = 'tab-close'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close tab');
    button.append(icon, title, close);
    button.onclick = () => activate(id);
    button.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') activate(id); };
    close.onclick = (event) => { event.stopPropagation(); closeTab(id); };
    $('tab-strip').append(button);
    const view = document.createElement('webview');
    view.setAttribute('src', 'about:blank');
    view.setAttribute('partition', 'cinema-private');
    const tab = { id, button, title, view, url: 'about:blank', ready: false, loading: false, error: null };
    tabs.set(id, tab);
    view.addEventListener('dom-ready', () => {
      tab.ready = true;
      if (activeId === id) updateToolbar();
    });
    view.addEventListener('did-start-loading', () => { tab.loading = true; if (activeId === id) updateToolbar(); });
    view.addEventListener('did-stop-loading', () => {
      tab.loading = false;
      if (tab.url !== 'about:blank') {
        const title = view.getTitle();
        if (title) tab.title.textContent = title;
      }
      if (activeId === id) updateToolbar();
    });
    const navigated = (event) => {
      if (!event.url) return;
      if (event.url === 'about:blank') { tab.url = 'about:blank'; tab.error = null; tab.title.textContent = 'New tab'; if (activeId === id) updateToolbar(); return; }
      tab.url = event.url;
      tab.error = null;
      tab.title.textContent = titleFor(tab.url);
      history.unshift({ title: tab.title.textContent, url: tab.url, when: Date.now() });
      if (history.length > 200) history.pop();
      if (activeId === id) updateToolbar();
    };
    view.addEventListener('did-navigate', navigated);
    view.addEventListener('did-navigate-in-page', navigated);
    view.addEventListener('page-title-updated', (event) => {
      if (event.title) tab.title.textContent = event.title;
      if (history[0]?.url === tab.url) history[0].title = tab.title.textContent;
    });
    view.addEventListener('did-fail-load', (event) => {
      if (!event.isMainFrame || event.errorCode === -3) return;
      tab.loading = false;
      tab.error = `${event.errorDescription} · ${event.validatedURL || tab.url}`;
      if (activeId === id) updateToolbar();
    });
    $('webviews').append(view);
    activate(id);
    if (url) navigate(url, tab);
    return tab;
  }
  function closeTab(id) {
    const tab = tabs.get(id);
    if (!tab) return;
    const others = [...tabs.keys()].filter((value) => value !== id);
    tab.view.remove();
    tab.button.remove();
    tabs.delete(id);
    if (!others.length) createTab();
    else if (activeId === id) activate(others[others.length - 1]);
  }
  function waitReady(tab) {
    if (tab.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tab did not start. Try a new tab.')), 8000);
      tab.view.addEventListener('dom-ready', () => { clearTimeout(timeout); resolve(); }, { once: true });
    });
  }
  async function navigate(value, tab = current()) {
    if (!tab || !String(value).trim()) return;
    try {
      await waitReady(tab);
      const result = await api.navigate({ id: tab.view.getWebContentsId(), url: value, searchEngine });
      tab.url = result.url;
      tab.error = null;
      tab.title.textContent = titleFor(result.url);
      tab.loading = true;
      if (activeId === tab.id) updateToolbar();
    } catch (error) { toast(error.message); }
  }
  function goHome() {
    const tab = current();
    if (!tab) return;
    tab.url = 'about:blank'; tab.error = null; tab.title.textContent = 'New tab';
    if (tab.ready) tab.view.loadURL('about:blank').catch(() => {});
    updateToolbar();
  }
  function renderQuickLinks() {
    $('quick-links').replaceChildren();
    const links = bookmarks.length ? bookmarks.slice(0, 10) : defaults;
    for (const link of links) {
      const button = document.createElement('button'); button.className = 'quick-link'; button.title = link.url;
      const symbol = document.createElement('span'); symbol.className = 'quick-icon'; symbol.textContent = link.title.charAt(0).toUpperCase();
      const label = document.createElement('span'); label.textContent = link.title;
      button.append(symbol, label);
      button.onclick = () => navigate(link.url);
      $('quick-links').append(button);
      if (/^https?:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.|\[|[^/]+\.(?:local|internal|test|onion))(?:[:/]|$)/i.test(link.url)) continue;
      api.getSiteIcon(link.url).then((src) => {
        if (!src || !button.isConnected) return;
        const image = document.createElement('img'); image.src = src; image.alt = '';
        image.onload = () => { if (button.isConnected) symbol.replaceChildren(image); };
      }).catch(() => {});
    }
  }
  function makePanelItem(item, remove) {
    const row = document.createElement('div'); row.className = 'panel-item';
    const open = document.createElement('button'); open.className = 'open'; open.textContent = item.title || item.url; open.title = item.url;
    open.onclick = () => { navigate(item.url); $('side-panel').hidden = true; };
    row.append(open);
    if (remove) {
      const del = document.createElement('button'); del.className = 'remove'; del.textContent = '×'; del.title = 'Remove';
      del.onclick = () => { bookmarks = bookmarks.filter((entry) => entry.url !== item.url); saveBookmarks(); updateToolbar(); };
      row.append(del);
    }
    return row;
  }
  async function showPanel(name) {
    $('menu').hidden = true; $('side-panel').hidden = false;
    const titles = { bookmarks: 'Bookmarks', history: 'History this session', settings: 'Settings & VPN' };
    $('panel-title').textContent = titles[name];
    const body = $('panel-body'); body.replaceChildren();
    if (name === 'bookmarks' || name === 'history') {
      const items = name === 'bookmarks' ? bookmarks : history;
      if (!items.length) { const p = document.createElement('p'); p.className = 'panel-empty'; p.textContent = name === 'bookmarks' ? 'Bookmark a page with the star in the address bar.' : 'Pages you open in this session appear here.'; body.append(p); return; }
      if (name === 'history') {
        const clear = document.createElement('button');
        clear.className = 'secondary-button'; clear.type = 'button'; clear.textContent = 'Clear all history';
        clear.onclick = async () => {
          clear.disabled = true;
          try {
            await api.clearHistory();
            history.length = 0;
            await showPanel('history');
            updateToolbar();
            toast('History cleared.');
          } catch (error) { clear.disabled = false; toast(error.message); }
        };
        body.append(clear);
      }
      const list = document.createElement('div'); list.className = 'panel-list';
      for (const item of items) list.append(makePanelItem(item, name === 'bookmarks'));
      body.append(list); return;
    }
    const search = document.createElement('div'); search.className = 'settings-group';
    search.innerHTML = '<h3>Search engine</h3><p>Choose where address-bar searches open.</p><label for="search-engine">Default search</label><select id="search-engine"><option value="duckduckgo">DuckDuckGo</option><option value="brave">Brave Search</option></select>';
    const searchSelect = search.querySelector('select');
    searchSelect.value = searchEngine;
    searchSelect.onchange = () => { searchEngine = searchSelect.value; localStorage.setItem('browser-search-engine', searchEngine); updateSearchLabels(); };
    const backup = document.createElement('div'); backup.className = 'settings-group backup-group';
    backup.innerHTML = '<h3>Back up your browser</h3><p>Save bookmarks and your search choice to a JSON file. Restore that file on this or another computer. The file is readable by anyone who has it; website passwords, cookies, and history are not included.</p><div class="backup-actions"><button id="export-backup" class="secondary-button" type="button">Save backup</button><button id="import-backup" class="secondary-button" type="button">Restore backup</button></div>';
    backup.querySelector('#export-backup').onclick = async () => {
      const button = backup.querySelector('#export-backup'); button.disabled = true;
      try { const result = await api.exportBackup({ bookmarks, searchEngine }); if (!result.canceled) toast('Browser backup saved.'); }
      catch (error) { toast(error.message); }
      finally { button.disabled = false; }
    };
    backup.querySelector('#import-backup').onclick = async () => {
      const button = backup.querySelector('#import-backup'); button.disabled = true;
      try {
        const result = await api.importBackup();
        if (!result.canceled) {
          bookmarks = result.bookmarks;
          searchEngine = result.searchEngine;
          localStorage.setItem('browser-search-engine', searchEngine);
          saveBookmarks(); updateSearchLabels(); updateToolbar();
          searchSelect.value = searchEngine;
          toast('Bookmarks and search choice restored.');
        }
      } catch (error) { toast(error.message); }
      finally { button.disabled = false; }
    };
    const network = document.createElement('div'); network.className = 'settings-group';
    network.innerHTML = '<h3>IP addresses</h3><p>Local addresses identify this laptop on its networks. The public IP is what a website sees through the current browser connection.</p><div id="local-ips" class="network-addresses">Checking local addresses…</div><button id="check-public-ip" class="secondary-button" type="button">Check public IP</button><p id="public-ip-result" class="muted">Public IP is checked only when you press the button.</p>';
    api.getNetworkInfo().then(({ local }) => {
      const box = network.querySelector('#local-ips');
      box.replaceChildren();
      if (!local.length) { box.textContent = 'No active local network address found.'; return; }
      for (const item of local) {
        const row = document.createElement('div');
        row.textContent = `${item.interface} · ${item.family} · ${item.address}`;
        box.append(row);
      }
    }).catch(() => { network.querySelector('#local-ips').textContent = 'Local addresses unavailable.'; });
    network.querySelector('#check-public-ip').onclick = async () => {
      const button = network.querySelector('#check-public-ip');
      const output = network.querySelector('#public-ip-result');
      button.disabled = true; output.textContent = 'Checking through the current browser connection…';
      try { const result = await api.checkPublicIp(); output.textContent = `${result.ip} · ${result.mode} connection`; }
      catch (error) { output.textContent = error.message; }
      finally { button.disabled = false; }
    };
    const guidance = document.createElement('div'); guidance.className = 'settings-group';
    guidance.innerHTML = '<h3>VPN connection</h3><p>Connect to your VPN provider in your operating system first, then browse here. A VPN account or server is required. This browser does not include a VPN service.</p><h3>Tor and .onion sites</h3><p>Start a local Tor service or Tor Browser, then choose its SOCKS5 port below. The connection check confirms SOCKS5, so make sure that service really is Tor. Ordinary websites work without Tor. This browser does not provide Tor Browser’s anonymity protections; use Tor Browser when anonymity matters.</p><h3>Browser proxy</h3><p>If your provider supplies an HTTP or SOCKS5 proxy, enter it below. A proxy only affects this browser session and is not a full VPN.</p>';
    const form = document.createElement('form'); form.className = 'settings-group';
    form.innerHTML = '<label for="proxy-mode">Connection mode</label><select id="proxy-mode" name="mode"><option value="system">Use system settings / VPN</option><option value="direct">Direct connection</option><option value="tor">Local Tor SOCKS5</option><option value="manual">Manual proxy</option></select><div id="tor-fields"><label for="tor-port">Local Tor port</label><input id="tor-port" name="torPort" type="number" min="1" max="65535" value="9050"><p>Usually 9050 for Tor service or 9150 for Tor Browser.</p></div><div id="proxy-fields"><label for="proxy-type">Proxy type</label><select id="proxy-type" name="type"><option value="http">HTTP</option><option value="socks5">SOCKS5</option></select><label for="proxy-host">Server host</label><input id="proxy-host" name="host" placeholder="proxy.example.com" autocomplete="off"><label for="proxy-port">Port</label><input id="proxy-port" name="port" type="number" min="1" max="65535" placeholder="8080"></div><button class="primary-button" type="submit">Apply connection</button>';
    const select = form.querySelector('#proxy-mode'); const fields = form.querySelector('#proxy-fields'); const torFields = form.querySelector('#tor-fields');
    select.onchange = () => { fields.hidden = select.value !== 'manual'; torFields.hidden = select.value !== 'tor'; };
    const currentProxy = await api.getProxy(); select.value = currentProxy.mode; form.querySelector('#tor-port').value = currentProxy.torPort; select.onchange();
    form.onsubmit = async (event) => { event.preventDefault(); try { await api.setProxy(Object.fromEntries(new FormData(form))); toast('Connection settings applied. Reload tabs to reconnect.'); } catch (error) { toast(error.message); } };
    const privacy = document.createElement('div'); privacy.className = 'settings-group';
    privacy.innerHTML = '<h3>Privacy</h3><p>Website cookies and storage remain in memory and disappear when the browser closes. Bookmarks remain saved on this device. The clear button erases temporary website data now.</p>';
    const clear = document.createElement('button'); clear.className = 'secondary-button'; clear.textContent = 'Clear website data now'; clear.onclick = clearData;
    privacy.append(clear); body.append(search, backup, network, guidance, form, privacy);
  }
  async function clearData() { try { await api.clearCache(); toast('Temporary website data cleared.'); } catch (error) { toast(error.message); } }
  function setAccountMode(mode) {
    accountMode = mode; const register = mode === 'register';
    $('mode-login').classList.toggle('selected', !register); $('mode-register').classList.toggle('selected', register);
    $('name-label').hidden = !register; $('telegram-label').hidden = !register; $('confirm-label').hidden = !register;
    const form = $('account-form');
    form.elements.name.required = register; form.elements.telegram_username.required = register; form.elements.password_confirmation.required = register;
    form.elements.password.minLength = register ? 10 : 1;
    form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
    $('account-submit').textContent = register ? 'Create account' : 'Sign in';
  }
  function renderAccount() {
    $('account-summary').hidden = !account?.user;
    $('account-form').hidden = !!account?.user;
    $('btn-account').textContent = account?.user?.name?.trim().charAt(0).toUpperCase() || 'A';
    if (account?.user) {
      $('account-avatar').textContent = $('btn-account').textContent;
      $('account-name').textContent = account.user.name;
      $('account-email').textContent = account.user.email;
      $('account-status').textContent = 'Browser bookmarks stay on this device. Use Settings & VPN to back them up.';
    }
  }
  $('new-tab').onclick = () => createTab();
  $('btn-back').onclick = () => { const tab = current(); if (tab?.ready) api.tabAction({ id: tab.view.getWebContentsId(), action: 'back' }).catch((error) => toast(error.message)); };
  $('btn-forward').onclick = () => { const tab = current(); if (tab?.ready) api.tabAction({ id: tab.view.getWebContentsId(), action: 'forward' }).catch((error) => toast(error.message)); };
  $('btn-reload').onclick = () => { const tab = current(); if (tab?.url !== 'about:blank') { tab.error = null; api.tabAction({ id: tab.view.getWebContentsId(), action: 'reload' }).catch((error) => toast(error.message)); updateToolbar(); } };
  $('btn-home').onclick = goHome;
  $('address-form').onsubmit = (event) => { event.preventDefault(); navigate($('url-input').value); $('url-input').blur(); };
  $('home-search').onsubmit = (event) => { event.preventDefault(); navigate($('home-input').value); $('home-input').value = ''; };
  $('btn-bookmark').onclick = () => { const url = currentUrl(); if (!url) return; if (bookmarks.some((item) => item.url === url)) bookmarks = bookmarks.filter((item) => item.url !== url); else bookmarks.push({ title: current().title.textContent, url }); saveBookmarks(); updateToolbar(); };
  $('btn-menu').onclick = () => { $('menu').hidden = !$('menu').hidden; $('side-panel').hidden = true; };
  $('btn-shield').onclick = () => toast('Ad and popup protection is active. Some site ads may still appear.');
  $('manage-bookmarks').onclick = () => showPanel('bookmarks');
  const dismissWelcome = () => {
    $('welcome-panel').hidden = true;
    $('dashboard-intro').hidden = false;
    localStorage.setItem('browser-welcome-seen', '1');
  };
  if (localStorage.getItem('browser-welcome-seen') === '1') {
    $('welcome-panel').hidden = true;
    $('dashboard-intro').hidden = false;
  }
  $('welcome-dismiss').onclick = dismissWelcome;
  $('welcome-start').onclick = () => { dismissWelcome(); $('home-input').focus(); };
  $('welcome-settings').onclick = () => { dismissWelcome(); showPanel('settings'); };
  document.querySelectorAll('#menu [data-panel]').forEach((button) => { button.onclick = () => showPanel(button.dataset.panel); });
  $('menu-clear').onclick = () => { $('menu').hidden = true; clearData(); };
  $('menu-fullscreen').onclick = () => { $('menu').hidden = true; api.toggleFullscreen(); };
  $('panel-close').onclick = () => { $('side-panel').hidden = true; };
  $('error-retry').onclick = () => { const tab = current(); if (tab?.url) navigate(tab.url); };
  $('btn-minimize').onclick = api.minimizeWindow; $('btn-maximize').onclick = api.maximizeWindow; $('btn-close').onclick = api.closeWindow;
  $('btn-account').onclick = async () => { $('account-error').textContent = ''; $('account-dialog').showModal(); try { account = await api.getAccount(); renderAccount(); } catch (error) { $('account-error').textContent = 'Account server unavailable. Browsing still works.'; } };
  $('account-close').onclick = () => $('account-dialog').close();
  $('mode-login').onclick = () => setAccountMode('login'); $('mode-register').onclick = () => setAccountMode('register');
  $('account-form').onsubmit = async (event) => { event.preventDefault(); $('account-error').textContent = ''; const button = $('account-submit'); button.disabled = true; try { account = await api[accountMode](Object.fromEntries(new FormData(event.target))); renderAccount(); event.target.reset(); } catch (error) { $('account-error').textContent = error.message; } finally { button.disabled = false; } };
  $('account-logout').onclick = async () => { try { await api.logout(); account = null; renderAccount(); } catch (error) { $('account-error').textContent = error.message; } };
  $('account-dashboard').onclick = () => api.openAccount().catch((error) => { $('account-error').textContent = error.message; });
  api.onBlockEvent((counts) => { $('blocked-count').textContent = counts.adsBlocked + counts.popupsBlocked; });
  api.onNavigationError(toast); api.onDownloadComplete((path) => toast('Download complete: ' + path));
  api.onLocked(() => { account = null; renderAccount(); });
  function shortcut(key) {
    if (key === 'new-tab') createTab();
    if (key === 'close-tab') closeTab(activeId);
    if (key === 'address') { $('url-input').focus(); $('url-input').select(); }
    if (key === 'reload') $('btn-reload').click();
    if (key === 'back') $('btn-back').click();
    if (key === 'forward') $('btn-forward').click();
    if (key === 'home') goHome();
    if (key === 'fullscreen') api.toggleFullscreen();
  }
  api.onShortcut(shortcut);
  document.addEventListener('keydown', (event) => {
    let key = null;
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 't') key = 'new-tab';
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'w') key = 'close-tab';
    if (event.ctrlKey && event.key.toLowerCase() === 'l') key = 'address';
    if ((event.ctrlKey && event.key.toLowerCase() === 'r') || event.key === 'F5') key = 'reload';
    if (event.altKey && event.key === 'ArrowLeft') key = 'back';
    if (event.altKey && event.key === 'ArrowRight') key = 'forward';
    if (event.altKey && event.key === 'Home') key = 'home';
    if (event.key === 'F11') key = 'fullscreen';
    if (key) { event.preventDefault(); shortcut(key); }
    if (event.key === 'Escape') { $('menu').hidden = true; $('side-panel').hidden = true; }
  });
  function updateSearchLabels() {
    const names = { duckduckgo: 'DuckDuckGo', brave: 'Brave Search' };
    $('url-input').placeholder = `Search ${names[searchEngine]} or enter a website address`;
    $('home-input').placeholder = `Search ${names[searchEngine]} or type a URL`;
  }
  setAccountMode('login'); updateSearchLabels(); renderQuickLinks(); createTab();
  api.getBlockStats().then((counts) => { $('blocked-count').textContent = counts.adsBlocked + counts.popupsBlocked; }).catch(() => {});
})();
