(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.cinemaApi;

  const defaults = [
    { title: 'Google', url: 'https://www.google.com' },
    { title: 'YouTube', url: 'https://www.youtube.com' },
    { title: 'Beenar', url: 'https://beenar.net' },
    { title: 'KurdSubtitle', url: 'https://kurdsubtitle.net' },
    { title: 'Kurdbin', url: 'https://kurdbin.kurdsat.tv' },
    { title: 'Kurdsat', url: 'https://kurdsat.tv' },
    { title: 'KurdViewer', url: 'https://kurdviewer.com' },
    { title: 'IMDb', url: 'https://www.imdb.com' }
  ];

  let bookmarks = [];
  try {
    bookmarks = JSON.parse(localStorage.getItem('browser-bookmarks') || '[]');
    if (!Array.isArray(bookmarks)) bookmarks = [];
  } catch {
    bookmarks = [];
  }

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
  let availableUpdate = null;
  let isUpdateDownloaded = false;

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
      btn.className = 'toolbar-pill license-btn lifetime';
      btn.title = 'CineStream Lifetime Access Active';
      if (icon) icon.textContent = '👑';
      label.textContent = 'Lifetime';
      if ($('license-status-box')) $('license-status-box').hidden = false;
      if ($('license-form')) $('license-form').hidden = true;
      if ($('license-eyebrow')) $('license-eyebrow').textContent = 'UNLOCKED';
      if ($('license-title')) $('license-title').textContent = 'Lifetime Access Active';
      const code = localStorage.getItem('cinestream_code');
      if ($('license-active-code')) $('license-active-code').textContent = code ? `Active Code: ${code}` : 'Lifetime license valid';
      if ($('license-desc')) $('license-desc').textContent = 'Your CineStream Browser is permanently unlocked. Enjoy unlimited ad-free movies & videos forever.';
      if ($('license-close')) {
        $('license-close').hidden = false;
        $('license-close').style.display = '';
      }
      return;
    }

    const remainingMs = getRemainingTrialMs();
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    if (remainingMs > 0) {
      btn.className = 'toolbar-pill license-btn trial';
      btn.title = `Free Trial Active (${hours}h ${minutes}m left)`;
      if (icon) icon.textContent = '⏳';
      label.textContent = hours > 0 ? `Trial: ${hours}h` : `Trial: ${minutes}m`;
      if ($('license-status-box')) $('license-status-box').hidden = true;
      if ($('license-form')) $('license-form').hidden = false;
      if ($('license-skip')) {
        $('license-skip').hidden = false;
        $('license-skip').style.display = '';
      }
      if ($('license-close')) {
        $('license-close').hidden = false;
        $('license-close').style.display = '';
      }
      if ($('license-eyebrow')) $('license-eyebrow').textContent = '1-DAY FREE TRIAL';
      if ($('license-title')) $('license-title').textContent = 'Activate CineStream';
      if ($('license-desc')) $('license-desc').textContent = `You have ${hours}h ${minutes}m remaining in your 1-day free trial. Enter a 6-digit code for lifetime access anytime.`;
    } else {
      btn.className = 'toolbar-pill license-btn expired';
      btn.title = 'Free Trial Expired - Activation Code Required';
      if (icon) icon.textContent = '🔒';
      label.textContent = 'Expired';
      if ($('license-status-box')) $('license-status-box').hidden = true;
      if ($('license-form')) $('license-form').hidden = false;
      if ($('license-skip')) {
        $('license-skip').hidden = true;
        $('license-skip').style.display = 'none';
      }
      if ($('license-close')) {
        $('license-close').hidden = true;
        $('license-close').style.display = 'none';
      }
      if ($('license-eyebrow')) $('license-eyebrow').textContent = 'TRIAL EXPIRED';
      if ($('license-title')) $('license-title').textContent = 'Enter 6-Digit Code';
      if ($('license-desc')) $('license-desc').textContent = 'Your 1-day free trial has expired. Please enter your 6-digit activation code to unlock lifetime access to CineStream Browser.';
      if ($('license-dialog') && !$('license-dialog').open) {
        $('license-dialog').showModal();
      }
    }
  }

  let toastTimer;
  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
  }

  function saveBookmarks() {
    localStorage.setItem('browser-bookmarks', JSON.stringify(bookmarks));
    renderQuickLinks();
    renderBookmarksBar();
    if (!$('side-panel').hidden && $('panel-title').textContent === 'Bookmarks') showPanel('bookmarks');
  }

  function current() { return tabs.get(activeId); }
  function currentUrl() { const tab = current(); return tab && tab.url !== 'about:blank' ? tab.url : ''; }

  function titleFor(url) {
    if (!url || url === 'about:blank') return 'New tab';
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./i, '');
    } catch {
      return url;
    }
  }

  function updateToolbar() {
    const tab = current();
    const url = currentUrl();
    if (document.activeElement !== $('url-input')) {
      $('url-input').value = url;
    }

    if ($('btn-bookmark')) {
      $('btn-bookmark').textContent = bookmarks.some((item) => item.url === url) ? '★' : '☆';
      $('btn-bookmark').classList.toggle('saved', bookmarks.some((item) => item.url === url));
      $('btn-bookmark').disabled = !url;
    }

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
    activeId = id;
    const tab = tabs.get(id);
    if (!tab) return;
    document.title = tab.url && tab.url !== 'about:blank' ? `${tab.title.textContent} - CineStream` : 'New Tab - CineStream';
    updateToolbar();
  }

  function createTab(url = '') {
    const id = nextId++;
    const button = document.createElement('button');
    button.className = 'tab';
    button.setAttribute('role', 'tab');
    button.tabIndex = 0;

    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#303134"/><path d="M12 2a10 10 0 0 1 10 10c0 .7-.08 1.38-.22 2.03L12 12V2z" fill="#ea4335"/><path d="M21.78 14.03A10 10 0 0 1 12 22v-10l9.78 2.03z" fill="#34a853"/><path d="M12 22A10 10 0 0 1 2 12l10 0v10z" fill="#fbbc05"/><path d="M2 12A10 10 0 0 1 12 2v10H2z" fill="#4285f4"/><circle cx="12" cy="12" r="4.5" fill="#ffffff"/></svg>`;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = 'New tab';

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close tab');

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

    const tab = { id, button, title, icon, view, url: 'about:blank', ready: false, loading: false, error: null };
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

    view.addEventListener('did-start-loading', () => {
      tab.loading = true;
      if (activeId === id) updateToolbar();
    });

    view.addEventListener('did-stop-loading', () => {
      tab.loading = false;
      if (tab.url !== 'about:blank') {
        const pageTitle = view.getTitle();
        if (pageTitle) tab.title.textContent = pageTitle;
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
      if (event.url === 'about:blank') {
        tab.url = 'about:blank';
        tab.error = null;
        tab.title.textContent = 'New tab';
        if (activeId === id) updateToolbar();
        return;
      }
      tab.url = event.url;
      tab.error = null;
      tab.title.textContent = titleFor(tab.url);
      history.unshift({ title: tab.title.textContent, url: tab.url, when: Date.now() });
      if (history.length > 200) history.pop();
      if (activeId === id) updateToolbar();

      // Fetch site favicon
      api.getSiteIcon(tab.url).then((src) => {
        if (src && tab.button.isConnected) {
          const img = document.createElement('img');
          img.src = src;
          img.onload = () => { if (tab.button.isConnected) tab.icon.replaceChildren(img); };
        }
      }).catch(() => {});
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
    } catch (error) {
      toast(error.message);
    }
  }

  function goHome() {
    const tab = current();
    if (!tab) return;
    tab.url = 'about:blank';
    tab.error = null;
    tab.title.textContent = 'New tab';
    if (tab.ready) tab.view.loadURL('about:blank').catch(() => {});
    updateToolbar();
  }

  function renderQuickLinks() {
    const container = $('quick-links');
    if (!container) return;
    container.replaceChildren();

    const links = bookmarks.slice(0, 4);
    for (const link of links) {
      const item = document.createElement('button');
      item.className = 'shortcut-item';
      item.title = link.title;
      item.type = 'button';

      const circle = document.createElement('div');
      circle.className = 'shortcut-circle';
      circle.textContent = link.title.charAt(0).toUpperCase();

      const label = document.createElement('span');
      label.textContent = link.title;

      item.append(circle, label);
      item.onclick = () => navigate(link.url);
      container.append(item);

      if (/^https?:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.|\[|[^/]+\.(?:local|internal|test|onion))(?:[:/]|$)/i.test(link.url)) continue;
      api.getSiteIcon(link.url).then((src) => {
        if (!src || !item.isConnected) return;
        const image = document.createElement('img');
        image.src = src;
        image.onload = () => { if (item.isConnected) circle.replaceChildren(image); };
      }).catch(() => {});
    }
  }

  function renderBookmarksBar() {
    const bar = $('bookmarks-items');
    if (!bar) return;
    bar.replaceChildren();

    const links = bookmarks.length ? bookmarks.slice(0, 8) : defaults.slice(0, 6);
    for (const link of links) {
      const item = document.createElement('button');
      item.className = 'bookmark-item';
      item.type = 'button';
      item.textContent = link.title;
      item.title = link.url;
      item.onclick = () => navigate(link.url);
      bar.append(item);
    }
  }

  function makePanelItem(item, remove) {
    const row = document.createElement('div');
    row.className = 'panel-item';
    const open = document.createElement('button');
    open.className = 'open';
    open.textContent = item.title || item.url;
    open.title = item.url;
    open.onclick = () => { navigate(item.url); $('side-panel').hidden = true; };
    row.append(open);
    if (remove) {
      const del = document.createElement('button');
      del.className = 'remove';
      del.textContent = '×';
      del.title = 'Remove';
      del.onclick = () => {
        bookmarks = bookmarks.filter((entry) => entry.url !== item.url);
        saveBookmarks();
        updateToolbar();
      };
      row.append(del);
    }
    return row;
  }

  async function showPanel(name) {
    $('menu').hidden = true;
    $('side-panel').hidden = false;
    const titles = { bookmarks: 'Bookmarks', history: 'History', downloads: 'Downloads', settings: 'Settings & Updates' };
    $('panel-title').textContent = titles[name] || 'Panel';
    const body = $('panel-body');
    body.replaceChildren();

    if (name === 'bookmarks' || name === 'history' || name === 'downloads') {
      const items = name === 'bookmarks' ? bookmarks : history;
      if (!items.length) {
        const p = document.createElement('p');
        p.className = 'panel-empty';
        p.textContent = name === 'bookmarks' ? 'No bookmarks saved yet. Star a page to save it.' : 'No browsing history in this session.';
        body.append(p);
        return;
      }
      if (name === 'history') {
        const clear = document.createElement('button');
        clear.className = 'secondary-button';
        clear.style.marginBottom = '12px';
        clear.textContent = 'Clear session history';
        clear.onclick = async () => {
          await api.clearHistory();
          history.length = 0;
          await showPanel('history');
          toast('History cleared.');
        };
        body.append(clear);
      }
      const list = document.createElement('div');
      list.className = 'panel-list';
      for (const item of items) list.append(makePanelItem(item, name === 'bookmarks'));
      body.append(list);
      return;
    }

    // Settings & Updates Panel
    const updateSection = document.createElement('div');
    updateSection.className = 'settings-group';
    updateSection.style.marginBottom = '20px';
    updateSection.innerHTML = `
      <h3 style="margin-bottom:6px;color:#fff;">CineStream Browser Updates</h3>
      <p style="color:#94a3b8;font-size:12px;margin-bottom:12px;">Automatic updates allow one-click installation of new browser releases and features.</p>
      <div style="display:flex;gap:10px;align-items:center;">
        <button id="btn-settings-check-update" class="primary-button" style="padding:8px 14px;font-size:12px;">Check for updates</button>
        <span id="settings-update-status" style="font-size:12px;color:#a8c7fa;">Version v1.1.0 (Installed)</span>
      </div>
    `;
    updateSection.querySelector('#btn-settings-check-update').onclick = () => checkUpdates(true);

    const searchSection = document.createElement('div');
    searchSection.className = 'settings-group';
    searchSection.innerHTML = `
      <h3 style="margin-bottom:6px;color:#fff;">Search Engine</h3>
      <p style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Choose default search engine for the address bar.</p>
      <select id="search-engine-select" style="width:100%;height:36px;background:#141517;color:#fff;border:1px solid #334155;border-radius:6px;padding:0 8px;">
        <option value="duckduckgo">DuckDuckGo</option>
        <option value="brave">Brave Search</option>
      </select>
    `;
    const searchSelect = searchSection.querySelector('select');
    searchSelect.value = searchEngine;
    searchSelect.onchange = () => {
      searchEngine = searchSelect.value;
      localStorage.setItem('browser-search-engine', searchEngine);
      toast('Search engine updated to ' + searchEngine);
    };

    const clearSection = document.createElement('div');
    clearSection.className = 'settings-group';
    clearSection.style.marginTop = '20px';
    clearSection.innerHTML = `
      <h3 style="margin-bottom:6px;color:#fff;">Browsing Data</h3>
      <p style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Clear session cache, cookies, and temporary data.</p>
      <button id="btn-clear-now" class="secondary-button" style="padding:8px 14px;font-size:12px;">Clear browsing data now</button>
    `;
    clearSection.querySelector('#btn-clear-now').onclick = async () => {
      await api.clearCache();
      toast('Browsing data cleared.');
    };

    body.append(updateSection, searchSection, clearSection);
  }

  // Auto-Update Engine
  async function checkUpdates(manual = false) {
    try {
      const info = await api.checkForUpdates();
      if (info && info.updateAvailable) {
        availableUpdate = info;
        showUpdateBanner(info);
        if (manual) toast(`A new version (${info.latestVersion}) is ready! Click update above.`);
      } else {
        if (manual) toast('CineStream is up to date.');
      }
    } catch (e) {
      if (manual) toast('Could not check updates: ' + e.message);
    }
  }

  function showUpdateBanner(info) {
    const banner = $('update-banner');
    if (!banner) return;
    $('update-banner-title').textContent = `Please update browser:`;
    $('update-banner-desc').textContent = `${info.title || `CineStream v${info.latestVersion} is available!`}`;
    banner.hidden = false;
  }

  function handleAutoUpdateClick() {
    if (isUpdateDownloaded) {
      // Install and restart
      api.installUpdate().catch((e) => toast('Failed to launch updater: ' + e.message));
      return;
    }

    const btn = $('btn-auto-update');
    btn.disabled = true;
    btn.textContent = '⚡ Downloading update...';
    $('update-progress-container').hidden = false;

    api.downloadUpdate({ url: availableUpdate?.downloads?.windows }).catch((err) => {
      btn.disabled = false;
      btn.textContent = '⚡ Click to Update Automatically';
      toast('Update download error: ' + err.message);
    });
  }

  // Preload IPC Listeners for Updater
  api.onUpdateProgress?.((data) => {
    const bar = $('update-progress-bar');
    const label = $('update-progress-label');
    if (bar) bar.style.width = `${data.percent}%`;
    if (label) label.textContent = `Downloading update... ${data.percent}%`;
  });

  api.onUpdateDownloaded?.((data) => {
    isUpdateDownloaded = true;
    const btn = $('btn-auto-update');
    btn.disabled = false;
    btn.textContent = '🔄 Restart & Apply Update';
    const label = $('update-progress-label');
    if (label) label.textContent = 'Update downloaded! Click to restart.';
    toast('Update downloaded successfully! Click Restart to apply.');
  });

  // UI Event Handlers
  $('new-tab').onclick = () => createTab();
  $('btn-search-tabs').onclick = () => $('tab-strip').scrollBy({ left: 100, behavior: 'smooth' });
  $('btn-back').onclick = () => { const tab = current(); if (tab?.ready) api.tabAction({ id: tab.view.getWebContentsId(), action: 'back' }).catch((e) => toast(e.message)); };
  $('btn-forward').onclick = () => { const tab = current(); if (tab?.ready) api.tabAction({ id: tab.view.getWebContentsId(), action: 'forward' }).catch((e) => toast(e.message)); };
  $('btn-reload').onclick = () => { const tab = current(); if (tab?.url !== 'about:blank') { tab.error = null; api.tabAction({ id: tab.view.getWebContentsId(), action: 'reload' }).catch((e) => toast(e.message)); updateToolbar(); } };
  $('btn-home').onclick = goHome;

  // Address Bar Submission
  $('address-form').onsubmit = (event) => {
    event.preventDefault();
    navigate($('url-input').value);
    $('url-input').blur();
  };

  // Google Search Home Submission
  $('home-search').onsubmit = (event) => {
    event.preventDefault();
    const query = $('home-input').value.trim();
    if (query) {
      navigate('https://www.google.com/search?q=' + encodeURIComponent(query));
      $('home-input').value = '';
    }
  };

  // AI Mode buttons
  const openAiMode = () => navigate('https://gemini.google.com');
  if ($('omnibox-ai-btn')) $('omnibox-ai-btn').onclick = openAiMode;
  if ($('btn-home-ai-mode')) $('btn-home-ai-mode').onclick = openAiMode;
  if ($('card-ai-mode')) $('card-ai-mode').onclick = openAiMode;
  if ($('card-ai-images')) $('card-ai-images').onclick = () => navigate('https://gemini.google.com');

  // Voice & Lens tools
  if ($('btn-voice-search')) $('btn-voice-search').onclick = () => {
    const q = prompt('Search Google by voice (Speak or type your query):');
    if (q) navigate('https://www.google.com/search?q=' + encodeURIComponent(q));
  };
  if ($('btn-lens-search')) $('btn-lens-search').onclick = () => navigate('https://images.google.com');

  // Continue with these tabs item
  if ($('continue-tab-item')) {
    $('continue-tab-item').onclick = () => navigate('https://coderahmad-browser.vercel.app');
  }
  if ($('see-more-link')) {
    $('see-more-link').onclick = (e) => { e.preventDefault(); showPanel('history'); };
  }

  // Add Shortcut
  if ($('btn-add-shortcut')) {
    $('btn-add-shortcut').onclick = () => {
      const url = prompt('Enter website URL:');
      if (url) {
        const title = prompt('Enter shortcut name:', titleFor(url)) || titleFor(url);
        bookmarks.push({ title, url: url.startsWith('http') ? url : 'https://' + url });
        saveBookmarks();
        toast('Shortcut added!');
      }
    };
  }

  // All Bookmarks & Customize Chrome
  if ($('btn-all-bookmarks')) $('btn-all-bookmarks').onclick = () => showPanel('bookmarks');
  if ($('btn-customize-chrome')) $('btn-customize-chrome').onclick = () => showPanel('settings');

  // Bookmark star in omnibox
  if ($('btn-bookmark')) {
    $('btn-bookmark').onclick = () => {
      const url = currentUrl();
      if (!url) return;
      if (bookmarks.some((item) => item.url === url)) {
        bookmarks = bookmarks.filter((item) => item.url !== url);
      } else {
        bookmarks.push({ title: current().title.textContent, url });
      }
      saveBookmarks();
      updateToolbar();
    };
  }

  // Auto-Update Banner actions
  if ($('btn-auto-update')) $('btn-auto-update').onclick = handleAutoUpdateClick;
  if ($('btn-dismiss-update')) $('btn-dismiss-update').onclick = () => { $('update-banner').hidden = true; };

  // Menu and Toolbars
  $('btn-menu').onclick = () => { $('menu').hidden = !$('menu').hidden; $('side-panel').hidden = true; };
  if ($('btn-downloads')) $('btn-downloads').onclick = () => showPanel('downloads');
  if ($('btn-extensions')) $('btn-extensions').onclick = () => toast('CineStream AdBlocker & Popup Interceptor v1.1.0 Active');
  $('btn-shield').onclick = () => toast('🛡️ CineStream Protection: Popups & video ads blocked automatically.');

  // Menu items
  if ($('menu-update')) $('menu-update').onclick = () => { $('menu').hidden = true; checkUpdates(true); };
  document.querySelectorAll('#menu [data-panel]').forEach((button) => { button.onclick = () => showPanel(button.dataset.panel); });
  document.querySelectorAll('#menu [data-action="new-tab"]').forEach((button) => { button.onclick = () => { $('menu').hidden = true; createTab(); }; });
  if ($('menu-clear')) $('menu-clear').onclick = async () => { $('menu').hidden = true; await api.clearCache(); toast('Browsing data cleared.'); };
  if ($('menu-fullscreen')) $('menu-fullscreen').onclick = () => { $('menu').hidden = true; api.toggleFullscreen(); };
  if ($('menu-exit')) $('menu-exit').onclick = () => api.closeWindow();

  $('panel-close').onclick = () => { $('side-panel').hidden = true; };
  $('error-retry').onclick = () => { const tab = current(); if (tab?.url) navigate(tab.url); };
  $('btn-minimize').onclick = api.minimizeWindow;
  $('btn-maximize').onclick = api.maximizeWindow;
  $('btn-close').onclick = api.closeWindow;

  // License dialog & activation
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

  function getDeviceId() {
    let id = localStorage.getItem('cinestream_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now().toString(36);
      localStorage.setItem('cinestream_device_id', id);
    }
    return id;
  }

  $('license-form').onsubmit = async (event) => {
    event.preventDefault();
    $('license-error').textContent = '';
    const input = $('license-input');
    const code = input.value.trim();
    const submitBtn = $('license-submit');
    submitBtn.disabled = true;
    try {
      const res = await api.verifyActivationCode({ code, deviceId: getDeviceId() });
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

  // Keyboard Shortcuts
  document.addEventListener('keydown', (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const key = event.key.toLowerCase();

    if (ctrl && !shift && key === 't') { event.preventDefault(); createTab(); }
    else if (ctrl && !shift && key === 'w') { event.preventDefault(); if (activeId) closeTab(activeId); }
    else if (ctrl && !shift && key === 'r') { event.preventDefault(); $('btn-reload').click(); }
    else if (ctrl && !shift && key === 'l') { event.preventDefault(); $('url-input').focus(); $('url-input').select(); }
    else if (ctrl && !shift && key === 'b') { event.preventDefault(); showPanel('bookmarks'); }
    else if (ctrl && !shift && key === 'h') { event.preventDefault(); showPanel('history'); }
    else if (ctrl && !shift && key === 'j') { event.preventDefault(); showPanel('downloads'); }
    else if (ctrl && !shift && key === 'f') { event.preventDefault(); $('find-bar').hidden = false; $('find-input').focus(); }
    else if (event.key === 'F11') { event.preventDefault(); api.toggleFullscreen(); }
    else if (event.key === 'Escape') {
      if (!$('find-bar').hidden) $('find-bar').hidden = true;
      if (!$('menu').hidden) $('menu').hidden = true;
      if (!$('side-panel').hidden) $('side-panel').hidden = true;
      if ($('license-dialog').open && (isLifetimeActive() || getRemainingTrialMs() > 0)) $('license-dialog').close();
    }
  });

  // Start Tab & Init
  getTrialStartTime();
  updateLicenseUI();
  renderQuickLinks();
  renderBookmarksBar();
  createTab();

  if (!isLifetimeActive() && getRemainingTrialMs() <= 0) {
    $('license-dialog').showModal();
  }

  setInterval(updateLicenseUI, 30000);
  api.getBlockStats().then((counts) => { $('blocked-count').textContent = counts.adsBlocked + counts.popupsBlocked; }).catch(() => {});

  // Check for updates automatically 2 seconds after startup
  setTimeout(() => checkUpdates(false), 2000);
})();
