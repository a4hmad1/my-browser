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
  const closedTabs = [];
  let contextTabId = null;
  let activeId = null;
  let nextId = 1;
  const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
  function getTrialStartTime() {
    let start = localStorage.getItem('cinestream_trial_start');
    if (!start) {
      start = String(Date.now());
      localStorage.setItem('cinestream_trial_start', start);
    }
    return parseInt(start, 10) || Date.now();
  }
  function isLifetimeActive() {
    return localStorage.getItem('cinestream_lifetime') === 'true';
  }
  function getRemainingTrialMs() {
    if (isLifetimeActive()) return Infinity;
    const start = getTrialStartTime();
    return Math.max(0, start + TRIAL_DURATION_MS - Date.now());
  }
  function updateLicenseUI() {
    const btn = $('btn-license');
    const label = $('license-label');
    const icon = $('license-icon');
    if (!btn || !label) return;

    if (isLifetimeActive()) {
      btn.className = 'license-btn lifetime';
      btn.title = 'CineStream Lifetime Access Active';
      if (icon) icon.textContent = '👑';
      label.textContent = 'Lifetime';
      $('license-status-box').hidden = false;
      $('license-form').hidden = true;
      $('license-eyebrow').textContent = 'UNLOCKED';
      $('license-title').textContent = 'Lifetime Access Active';
      const code = localStorage.getItem('cinestream_code');
      $('license-active-code').textContent = code ? `Active Code: ${code}` : 'Lifetime license valid';
      $('license-desc').textContent = 'Your CineStream Browser is permanently unlocked. Enjoy unlimited ad-free movies & videos forever.';
      $('license-close').hidden = false;
      $('license-close').style.display = '';
      return;
    }

    const remainingMs = getRemainingTrialMs();
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    if (remainingMs > 0) {
      btn.className = 'license-btn trial';
      btn.title = `Free Trial Active (${hours}h ${minutes}m left)`;
      if (icon) icon.textContent = '⏳';
      label.textContent = hours > 0 ? `Trial: ${hours}h` : `Trial: ${minutes}m`;
      $('license-status-box').hidden = true;
      $('license-form').hidden = false;
      $('license-skip').hidden = false;
      $('license-skip').style.display = '';
      $('license-close').hidden = false;
      $('license-close').style.display = '';
      $('license-eyebrow').textContent = '1-DAY FREE TRIAL';
      $('license-title').textContent = 'Activate CineStream';
      $('license-desc').textContent = `You have ${hours}h ${minutes}m remaining in your 1-day free trial. Enter a 6-digit code for lifetime access anytime.`;
    } else {
      btn.className = 'license-btn expired';
      btn.title = 'Free Trial Expired - Activation Code Required';
      if (icon) icon.textContent = '🔒';
      label.textContent = 'Expired';
      $('license-status-box').hidden = true;
      $('license-form').hidden = false;
      $('license-skip').hidden = true;
      $('license-skip').style.display = 'none';
      $('license-close').hidden = true;
      $('license-close').style.display = 'none';
      $('license-eyebrow').textContent = 'TRIAL EXPIRED';
      $('license-title').textContent = 'Enter 6-Digit Code';
      $('license-desc').textContent = 'Your 1-day free trial has expired. Please enter your 6-digit activation code to unlock lifetime access to CineStream Browser.';
      if (!$('license-dialog').open) {
        $('license-dialog').showModal();
      }
    }
  }
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
    button.onauxclick = (event) => { if (event.button === 1) { event.preventDefault(); closeTab(id); } };
    button.oncontextmenu = (event) => { event.preventDefault(); showTabContextMenu(event.clientX, event.clientY, id); };
    close.onclick = (event) => { event.stopPropagation(); closeTab(id); };
    $('tab-strip').append(button);
    const view = document.createElement('webview');
    view.setAttribute('src', 'about:blank');
    view.setAttribute('partition', 'cinema-private');
    view.setAttribute('allowfullscreen', 'true');
    view.allowfullscreen = true;
    const tab = { id, button, title, view, url: 'about:blank', ready: false, loading: false, error: null, zoomFactor: 1.0 };
    tabs.set(id, tab);
    view.addEventListener('enter-html-full-screen', () => {
      document.querySelector('.window')?.classList.add('fullscreen-mode');
    });
    view.addEventListener('leave-html-full-screen', () => {
      document.querySelector('.window')?.classList.remove('fullscreen-mode');
    });
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
    view.addEventListener('found-in-page', (event) => {
      if (event.result) {
        const { activeMatchOrdinal, numberOfMatches } = event.result;
        $('find-count').textContent = numberOfMatches ? `${activeMatchOrdinal} of ${numberOfMatches}` : '0 of 0';
      }
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
    closedTabs.push({ url: tab.url === 'about:blank' ? '' : tab.url, title: tab.title.textContent });
    if (closedTabs.length > 30) closedTabs.shift();
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
    if (!isLifetimeActive() && getRemainingTrialMs() <= 0) {
      updateLicenseUI();
      if (!$('license-dialog').open) $('license-dialog').showModal();
      toast('Free trial expired. Please enter your 6-digit activation code.');
      return;
    }
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
  if ($('welcome-code')) {
    $('welcome-code').onclick = () => {
      $('license-error').textContent = '';
      updateLicenseUI();
      $('license-dialog').showModal();
    };
  }
  document.querySelectorAll('#menu [data-panel]').forEach((button) => { button.onclick = () => showPanel(button.dataset.panel); });
  $('menu-clear').onclick = () => { $('menu').hidden = true; clearData(); };
  $('menu-fullscreen').onclick = () => { $('menu').hidden = true; api.toggleFullscreen(); };
  $('panel-close').onclick = () => { $('side-panel').hidden = true; };
  $('error-retry').onclick = () => { const tab = current(); if (tab?.url) navigate(tab.url); };
  $('btn-minimize').onclick = api.minimizeWindow; $('btn-maximize').onclick = api.maximizeWindow; $('btn-close').onclick = api.closeWindow;
  $('btn-license').onclick = () => {
    $('license-error').textContent = '';
    updateLicenseUI();
    $('license-dialog').showModal();
  };
  $('license-close').onclick = () => {
    if (isLifetimeActive() || getRemainingTrialMs() > 0) {
      $('license-dialog').close();
    }
  };
  $('license-skip').onclick = () => {
    localStorage.setItem('cinestream_first_prompt_seen', 'true');
    $('license-dialog').close();
    toast('1-Day Free Trial Active. Enjoy CineStream!');
  };
  $('license-form').onsubmit = async (event) => {
    event.preventDefault();
    $('license-error').textContent = '';
    const input = $('license-input');
    const code = input.value.trim();
    const submitBtn = $('license-submit');
    submitBtn.disabled = true;
    try {
      const res = await api.verifyActivationCode(code);
      if (res?.valid) {
        localStorage.setItem('cinestream_lifetime', 'true');
        localStorage.setItem('cinestream_code', code);
        localStorage.setItem('cinestream_first_prompt_seen', 'true');
        updateLicenseUI();
        $('license-dialog').close();
        toast('🎉 Lifetime access activated! Welcome to CineStream.');
      }
    } catch (error) {
      $('license-error').textContent = error.message || 'Invalid activation code.';
    } finally {
      submitBtn.disabled = false;
    }
  };
  api.onBlockEvent((counts) => { $('blocked-count').textContent = counts.adsBlocked + counts.popupsBlocked; });
  api.onNavigationError(toast);
  api.onDownloadComplete((path) => toast('Download complete: ' + path));
  api.onHtmlFullscreen?.((isFullscreen) => {
    document.querySelector('.window')?.classList.toggle('fullscreen-mode', isFullscreen);
  });
  $('tab-strip').ondblclick = (event) => { if (event.target === $('tab-strip')) createTab(); };
  $('url-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault();
      const val = $('url-input').value.trim();
      if (val) createTab(val);
    }
  });

  function showTabContextMenu(x, y, tabId) {
    contextTabId = tabId;
    const menu = $('tab-context-menu');
    menu.hidden = false;
    menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
    menu.style.top = `${y}px`;
  }
  $('tab-context-menu').querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      $('tab-context-menu').hidden = true;
      if (!contextTabId) return;
      const action = btn.dataset.action;
      if (action === 'new-tab') createTab();
      else if (action === 'reload-tab') { const t = tabs.get(contextTabId); if (t?.ready) t.view.reload(); }
      else if (action === 'duplicate-tab') { const t = tabs.get(contextTabId); if (t) createTab(t.url === 'about:blank' ? '' : t.url); }
      else if (action === 'close-tab') closeTab(contextTabId);
      else if (action === 'close-other-tabs') {
        for (const id of [...tabs.keys()]) { if (id !== contextTabId) closeTab(id); }
        activate(contextTabId);
      }
    };
  });
  document.addEventListener('click', (e) => {
    if (!$('tab-context-menu').hidden && !$('tab-context-menu').contains(e.target)) {
      $('tab-context-menu').hidden = true;
    }
  });

  function openFindBar() {
    $('find-bar').hidden = false;
    $('find-input').focus();
    $('find-input').select();
    const val = $('find-input').value.trim();
    if (val && current()?.view) current().view.findInPage(val);
  }
  function closeFindBar() {
    $('find-bar').hidden = true;
    const tab = current();
    if (tab?.view) tab.view.stopFindInPage('clearSelection');
    $('find-count').textContent = '';
  }
  function findNext() {
    const tab = current();
    const val = $('find-input').value.trim();
    if (tab?.view && val) tab.view.findInPage(val, { findNext: true, forward: true });
  }
  function findPrev() {
    const tab = current();
    const val = $('find-input').value.trim();
    if (tab?.view && val) tab.view.findInPage(val, { findNext: true, forward: false });
  }
  $('find-input').oninput = () => {
    const val = $('find-input').value.trim();
    const tab = current();
    if (tab?.view) {
      if (val) tab.view.findInPage(val);
      else { tab.view.stopFindInPage('clearSelection'); $('find-count').textContent = ''; }
    }
  };
  $('find-input').onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) findPrev(); else findNext(); }
    if (e.key === 'Escape') { e.preventDefault(); closeFindBar(); }
  };
  $('find-prev').onclick = findPrev;
  $('find-next').onclick = findNext;
  $('find-close').onclick = closeFindBar;

  function shortcut(key) {
    if (key === 'new-tab') { createTab(); $('url-input').focus(); $('url-input').select(); }
    else if (key === 'reopen-closed-tab') {
      if (closedTabs.length) {
        const item = closedTabs.pop();
        createTab(item.url);
        toast('Reopened tab: ' + (item.title || item.url));
      } else {
        toast('No recently closed tabs');
      }
    }
    else if (key === 'close-tab') closeTab(activeId);
    else if (key === 'next-tab') {
      const ids = [...tabs.keys()];
      if (ids.length > 1) {
        const idx = ids.indexOf(activeId);
        activate(ids[(idx + 1) % ids.length]);
      }
    }
    else if (key === 'prev-tab') {
      const ids = [...tabs.keys()];
      if (ids.length > 1) {
        const idx = ids.indexOf(activeId);
        activate(ids[(idx - 1 + ids.length) % ids.length]);
      }
    }
    else if (key.startsWith('switch-tab-')) {
      const num = parseInt(key.replace('switch-tab-', ''), 10) - 1;
      const ids = [...tabs.keys()];
      if (ids[num]) activate(ids[num]);
    }
    else if (key === 'last-tab') {
      const ids = [...tabs.keys()];
      if (ids.length) activate(ids[ids.length - 1]);
    }
    else if (key === 'address') { $('url-input').focus(); $('url-input').select(); }
    else if (key === 'reload') {
      const tab = current();
      if (tab?.loading && tab?.view) { tab.view.stop(); toast('Page loading stopped'); }
      else $('btn-reload').click();
    }
    else if (key === 'hard-reload') {
      const tab = current();
      if (tab?.view && tab?.ready) {
        tab.view.reloadIgnoringCache();
        toast('Page refreshed (cache bypassed)');
      } else {
        $('btn-reload').click();
      }
    }
    else if (key === 'back') $('btn-back').click();
    else if (key === 'forward') $('btn-forward').click();
    else if (key === 'home') goHome();
    else if (key === 'toggle-bookmark') {
      const url = currentUrl();
      if (url) {
        $('btn-bookmark').click();
        const saved = bookmarks.some((item) => item.url === url);
        toast(saved ? 'Added to bookmarks ★' : 'Removed from bookmarks ☆');
      }
    }
    else if (key === 'bookmarks-panel') {
      if ($('side-panel').hidden || $('panel-title').textContent !== 'Bookmarks') showPanel('bookmarks');
      else $('side-panel').hidden = true;
    }
    else if (key === 'history-panel') {
      if ($('side-panel').hidden || $('panel-title').textContent !== 'History this session') showPanel('history');
      else $('side-panel').hidden = true;
    }
    else if (key === 'downloads-panel') {
      if ($('side-panel').hidden || $('panel-title').textContent !== 'Settings & VPN') showPanel('settings');
      else $('side-panel').hidden = true;
    }
    else if (key === 'clear-data') $('menu-clear').click();
    else if (key === 'zoom-in' || key === 'zoom-out' || key === 'zoom-reset') {
      const tab = current();
      if (tab?.view) {
        if (!tab.zoomFactor) tab.zoomFactor = 1.0;
        if (key === 'zoom-in') tab.zoomFactor = Math.min(Number(((tab.zoomFactor || 1) + 0.1).toFixed(1)), 3.0);
        else if (key === 'zoom-out') tab.zoomFactor = Math.max(Number(((tab.zoomFactor || 1) - 0.1).toFixed(1)), 0.25);
        else if (key === 'zoom-reset') tab.zoomFactor = 1.0;
        tab.view.setZoomFactor(tab.zoomFactor);
        toast(`Zoom: ${Math.round(tab.zoomFactor * 100)}%`);
      }
    }
    else if (key === 'find-in-page') openFindBar();
    else if (key === 'find-next') findNext();
    else if (key === 'find-prev') findPrev();
    else if (key === 'fullscreen') api.toggleFullscreen();
    else if (key === 'devtools') {
      const tab = current();
      if (tab?.view) {
        try {
          if (tab.view.isDevToolsOpened()) tab.view.closeDevTools();
          else tab.view.openDevTools();
        } catch {}
      }
    }
    else if (key === 'print') {
      const tab = current();
      if (tab?.view) { try { tab.view.print(); } catch {} }
    }
    else if (key === 'view-source') {
      const url = currentUrl();
      if (url) createTab('view-source:' + url);
    }
    else if (key === 'escape') {
      if (document.querySelector('.window')?.classList.contains('fullscreen-mode')) {
        document.querySelector('.window').classList.remove('fullscreen-mode');
        return;
      }
      if (!$('find-bar').hidden) { closeFindBar(); return; }
      if (!$('tab-context-menu').hidden) { $('tab-context-menu').hidden = true; return; }
      if (!$('menu').hidden) { $('menu').hidden = true; return; }
      if (!$('side-panel').hidden) { $('side-panel').hidden = true; return; }
      if ($('license-dialog').open) {
        if (isLifetimeActive() || getRemainingTrialMs() > 0) {
          $('license-dialog').close();
        }
        return;
      }
      const tab = current();
      if (tab && tab.loading && tab.view) { tab.view.stop(); toast('Loading stopped'); }
      if (document.activeElement === $('url-input')) {
        $('url-input').value = currentUrl();
        $('url-input').blur();
      }
    }
  }
  api.onShortcut(shortcut);
  document.addEventListener('keydown', (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    const key = event.key.toLowerCase();
    const code = event.code;

    let target = null;
    if (ctrl && !shift && key === 't') target = 'new-tab';
    else if (ctrl && shift && key === 't') target = 'reopen-closed-tab';
    else if (ctrl && !shift && (key === 'w' || key === 'f4')) target = 'close-tab';
    else if ((ctrl && !shift && (key === 'tab' || code === 'PageDown')) || (alt && ctrl && key === 'arrowright')) target = 'next-tab';
    else if ((ctrl && shift && (key === 'tab' || code === 'PageUp')) || (alt && ctrl && key === 'arrowleft')) target = 'prev-tab';
    else if (ctrl && !shift && key >= '1' && key <= '8') target = 'switch-tab-' + key;
    else if (ctrl && !shift && key === '9') target = 'last-tab';
    else if (ctrl && !shift && key === 'n') target = 'new-tab';

    else if ((ctrl && key === 'l') || (alt && key === 'd') || key === 'f6') target = 'address';
    else if ((ctrl && shift && key === 'r') || (ctrl && key === 'f5')) target = 'hard-reload';
    else if ((ctrl && !shift && key === 'r') || event.key === 'F5') target = 'reload';
    else if (alt && event.key === 'ArrowLeft') target = 'back';
    else if (alt && event.key === 'ArrowRight') target = 'forward';
    else if (alt && event.key === 'Home') target = 'home';

    else if (ctrl && !shift && key === 'd') target = 'toggle-bookmark';
    else if (ctrl && (shift && key === 'd' || !shift && key === 'b' || shift && key === 'o')) target = 'bookmarks-panel';
    else if (ctrl && !shift && (key === 'h' || key === 'y')) target = 'history-panel';
    else if (ctrl && !shift && key === 'j') target = 'downloads-panel';
    else if (ctrl && shift && (key === 'delete' || code === 'Delete')) target = 'clear-data';

    else if (ctrl && (key === '=' || key === '+' || code === 'NumpadAdd' || code === 'Equal')) target = 'zoom-in';
    else if (ctrl && (key === '-' || code === 'NumpadSubtract' || code === 'Minus')) target = 'zoom-out';
    else if (ctrl && (key === '0' || code === 'Numpad0' || code === 'Digit0')) target = 'zoom-reset';

    else if (ctrl && !shift && key === 'f') target = 'find-in-page';
    else if (event.key === 'F3') target = shift ? 'find-prev' : 'find-next';
    else if (event.key === 'Escape') target = 'escape';

    else if (event.key === 'F11') target = 'fullscreen';
    else if (event.key === 'F12' || (ctrl && shift && (key === 'i' || key === 'j'))) target = 'devtools';
    else if (ctrl && !shift && key === 'p') target = 'print';
    else if (ctrl && !shift && key === 'u') target = 'view-source';

    if (target) {
      event.preventDefault();
      shortcut(target);
    }
  });
  function updateSearchLabels() {
    const names = { duckduckgo: 'DuckDuckGo', brave: 'Brave Search' };
    $('url-input').placeholder = `Search ${names[searchEngine]} or enter a website address`;
    $('home-input').placeholder = `Search ${names[searchEngine]} or type a URL`;
  }
  getTrialStartTime();
  updateLicenseUI();
  updateSearchLabels();
  renderQuickLinks();
  createTab();
  if (!isLifetimeActive() && getRemainingTrialMs() <= 0) {
    $('license-dialog').showModal();
  }
  setInterval(updateLicenseUI, 30000);
  api.getBlockStats().then((counts) => { $('blocked-count').textContent = counts.adsBlocked + counts.popupsBlocked; }).catch(() => {});
})();
