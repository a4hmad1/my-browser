document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id),
    api = window.cinemaApi;
  let state = { user: null, access: null },
    allSites = [],
    mode = "login",
    yearly = false,
    theater = false;
  const webview = $("movie-webview");
  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    setTimeout(() => $("toast").classList.remove("show"), 4000);
  }
  function setMode(next) {
    mode = next;
    $("account-error").textContent = "";
    $("name-field").hidden = mode !== "register";
    $("telegram-field").hidden = mode !== "register";
    $("auth-form").elements.telegram_username.required = mode === "register";
    $("reset-field").hidden = mode !== "reset";
    $("confirm-field").hidden = mode === "login";
    $("reset-help").hidden = mode !== "reset";
    $("auth-submit").textContent =
      mode === "register"
        ? "Start my free day ↗"
        : mode === "reset"
          ? "Update password ↗"
          : "Sign in ↗";
    $("auth-form").elements.name.required = mode === "register";
    $("auth-form").elements.token.required = mode === "reset";
    $("auth-form").elements.password_confirmation.required = mode !== "login";
    $("auth-form").elements.password.minLength = mode === "login" ? 1 : 10;
    $("auth-form").elements.password.autocomplete =
      mode === "login" ? "current-password" : "new-password";
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("selected", b.dataset.mode === mode));
  }
  function renderPlans() {
    const plans = [
      {
        name: "Basic",
        monthly: 5000,
        yearly: 57000,
        detail: "Curated directory · Protected browsing",
      },
      {
        name: "Plus",
        monthly: 10000,
        yearly: 114000,
        detail: "10 personal websites · Favorites",
      },
      {
        name: "Pro",
        monthly: 20000,
        yearly: 228000,
        detail: "100 personal websites · Favorites & search",
      },
    ];
    $("plan-cards").replaceChildren();
    for (const p of plans) {
      const card = document.createElement("article"),
        title = document.createElement("h3"),
        price = document.createElement("strong"),
        detail = document.createElement("small");
      title.textContent = p.name;
      price.textContent =
        (yearly ? p.yearly : p.monthly).toLocaleString() +
        " IQD / " +
        (yearly ? "year" : "month");
      detail.textContent = p.detail;
      card.append(title, price, detail);
      $("plan-cards").append(card);
    }
    $("billing-toggle").textContent = yearly
      ? "Switch to monthly"
      : "Switch to yearly · Save 5%";
  }
  function showAccount() {
    $("account-gate").hidden = false;
    $("account-identity").hidden = !state.user;
    if (state.user) {
      $("account-panel-avatar").textContent = state.user.name?.trim().charAt(0).toUpperCase() || "A";
      $("account-panel-name").textContent = state.user.name || "Your account";
      $("account-panel-email").textContent = state.user.email || "";
      $("account-panel-status").textContent = state.access?.suspended
        ? "Suspended"
        : state.access?.telegram_required
          ? "Verify Telegram"
          : state.access?.active ? "Active" : "Expired";
    }
    $("auth-form").hidden = !!state.user;
    $("auth-tabs").hidden = !!state.user;
    $("member-panel").hidden = !state.user;
    $("telegram-onboarding").hidden = !state.user || state.access?.telegram_verified;
    $("btn-telegram").hidden = !state.telegram_url && !state.access?.telegram_linked;
    $("telegram-link-form").hidden = !!state.telegram_url || state.access?.telegram_linked;
    $("btn-dismiss").hidden = !state.access?.active;
    $("gate-title").textContent = state.user
      ? state.access?.suspended
        ? "Your account is suspended."
        : state.access?.telegram_required
          ? "Finish your Telegram verification."
          : state.access?.active
          ? "Your cinema membership."
          : "Choose your next movie night."
      : "Your first movie night is on us.";
    $("gate-description").textContent = state.user
      ? state.access?.suspended
        ? "Contact your administrator to reactivate your account."
        : "Activate a subscription code from your administrator. Annual memberships save 5%."
      : "Sign in or create your account for a 24-hour free trial. پێش بەکارهێنان هەژمار تۆمار بکە.";
    renderPlans();
  }
  async function applyState(result) {
    state = result;
    $("account-label").textContent = state.user?.name || "Account";
    $("account-avatar").textContent = state.user?.name?.trim().charAt(0).toUpperCase() || "A";
    $("btn-add-site").hidden =
      !state.access?.active || !state.access?.custom_site_limit;
    if (state.access?.active) {
      $("account-gate").hidden = true;
      $("membership").textContent =
        (state.access.trial ? "Free day" : state.access.plan.toUpperCase()) +
        " · Access ends " +
        new Date(state.access.ends_at).toLocaleString();
      try {
        allSites = (await api.getCatalog()).sites;
        renderSites();
      } catch (err) {
        toast("Could not refresh the movie directory: " + err.message);
      }
    } else {
      home(false);
      showAccount();
    }
  }
  function renderSites() {
    $("sites-grid").replaceChildren();
    const q = $("filter-input").value.trim().toLowerCase(),
      language = $("language-filter").value;
    const filtered = allSites.filter(
      (s) =>
        (language === "All languages" ||
          s.language === language ||
          (language === "Personal" && s.id)) &&
        [s.name, s.tag, s.description, s.url]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
    $("sites-count").textContent = filtered.length;
    if (!filtered.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No websites match your search.";
      $("sites-grid").append(p);
      return;
    }
    for (const site of filtered) {
      const card = document.createElement('article');
      card.className = 'site-item site-card';
      const launch = document.createElement('button');
      launch.className = 'site-launch';
      launch.title = site.description || site.name;
      launch.setAttribute('aria-label', site.name);
      const wrapper = document.createElement('span');
      wrapper.className = 'site-icon-wrapper';
      const icon = document.createElement('img');
      icon.className = 'site-api-logo';
      icon.alt = '';
      icon.hidden = true;
      const fallback = document.createElement('span');
      fallback.className = 'site-code';
      fallback.textContent = site.name.slice(0, 3).toUpperCase();
      const localIcon = site.icon && /^[a-z]+\.svg$/.test(site.icon) ? './icons/' + site.icon : null;
      let localIconFailed = false;
      icon.onload = () => { icon.hidden = false; fallback.hidden = true; };
      icon.onerror = () => {
        if (icon.src.startsWith('data:') && localIcon && !localIconFailed) {
          icon.src = localIcon;
          return;
        }
        if (localIcon && icon.src.endsWith(localIcon)) localIconFailed = true;
        icon.hidden = true;
        fallback.hidden = false;
      };
      if (localIcon) icon.src = localIcon;
      api.getSiteIcon(site.url)
        .then(src => { if (src) icon.src = src; })
        .catch(() => {});
      wrapper.append(icon, fallback);
      const title = document.createElement('span');
      title.className = 'site-name';
      title.textContent = site.name;
      launch.append(wrapper, title);
      launch.addEventListener('click', () => navigate(site.url));
      card.append(launch);
      if (site.id) {
        const actions = document.createElement("div");
        actions.className = "site-actions";
        const favorite = document.createElement("button"),
          remove = document.createElement("button");
        favorite.textContent = site.favorite ? "★ Favorite" : "☆ Favorite";
        remove.textContent = "Remove";
        favorite.onclick = async () => {
          try {
            allSites = (
              await api.favorite({ id: site.id, favorite: !site.favorite })
            ).sites;
            renderSites();
          } catch (e) {
            toast(e.message);
          }
        };
        remove.onclick = async () => {
          try {
            allSites = (await api.removeSite(site.id)).sites;
            renderSites();
          } catch (e) {
            toast(e.message);
          }
        };
        actions.append(favorite, remove);
        card.append(actions);
      }
      $("sites-grid").append(card);
    }
  }
  async function navigate(value) {
    let target = value.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    try {
      if (!new URL(target).hostname.includes("."))
        throw new Error("Enter a website address from your directory.");
      $("catalog-view").hidden = true;
      $("player-view").classList.add("active");
      $("player-view").hidden = false;
      $("url-input").value = target;
      $("loading-bar").classList.add("loading");
      await api.navigate(target);

    } catch (err) {
      home(false);
      toast(err.message);
    }
  }
  function home(stop = true) {
    $("catalog-view").hidden = false;
    $("player-view").hidden = true;
    $("player-view").classList.remove("active");
    $("url-input").value = "";

    $("btn-back").disabled = true;
    $("btn-forward").disabled = true;
    $("loading-bar").classList.remove("loading");
    if (stop) api.navigate("about:blank").catch(() => {});
  }
  $("auth-form").onsubmit = async (e) => {
    e.preventDefault();
    $("account-error").textContent = "";
    $("auth-submit").disabled = true;
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (mode === "reset") {
        await api.resetPassword(data);
        setMode("login");
        toast("Password updated. Sign in again.");
      } else
        await applyState(
          await (mode === "register" ? api.register(data) : api.login(data)),
        );
      e.target.elements.password.value = "";
      e.target.elements.password_confirmation.value = "";
    } catch (err) {
      $("account-error").textContent = err.message;
    } finally {
      $("auth-submit").disabled = false;
    }
  };
  $("btn-telegram").onclick = () => api.openTelegram().catch(e => toast(e.message));
  $("telegram-link-form").onsubmit = async (e) => {
    e.preventDefault();
    try { await api.linkTelegram(Object.fromEntries(new FormData(e.target))); e.target.reset(); }
    catch (err) { $("account-error").textContent = err.message; }
  };
  $("telegram-verify-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await applyState(await api.verifyTelegram(Object.fromEntries(new FormData(e.target)))); e.target.reset(); }
    catch (err) { $("account-error").textContent = err.message; }
    finally { btn.disabled = false; }
  };
  $("activation-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await applyState(
        await api.activate(Object.fromEntries(new FormData(e.target))),
      );
      e.target.reset();
      toast("Membership activated. Enjoy your cinema.");
    } catch (err) {
      $("account-error").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
  $("site-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      allSites = (await api.addSite(Object.fromEntries(new FormData(e.target))))
        .sites;
      $("language-filter").value = "Personal";
      $("filter-input").value = "";
      renderSites();
      toast("Website added. Click its icon to open it.");
      $("site-dialog").close();
      e.target.reset();
    } catch (err) {
      $("site-error").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $("billing-toggle").onclick = () => {
    yearly = !yearly;
    renderPlans();
  };
  $("btn-dashboard").onclick = () =>
    api.openAccount().catch((e) => toast(e.message));
  $("btn-logout").onclick = async () => {
    try {
      await api.logout();
      setMode("login");
      await applyState({ user: null, access: null });
    } catch (e) {
      toast(e.message);
    }
  };
  $("btn-dismiss").onclick = () => {
    $("account-gate").hidden = true;
  };
  $("btn-account").onclick = async () => {
    try {
      await applyState(await api.getAccount());
      showAccount();
    } catch (err) {
      showAccount();
      $("account-error").textContent = err.message;
    }
  };
  $("btn-add-site").onclick = () => {
    $("site-error").textContent = "";
    $("site-dialog").showModal();
  };
  $("cancel-site").onclick = () => $("site-dialog").close();
  $("btn-home").onclick = () => home();

  $("btn-go").onclick = () => navigate($("url-input").value);
  $("url-input").onkeydown = (e) => {
    if (e.key === "Enter") navigate(e.target.value);
  };
  $("filter-input").oninput = renderSites;
  $("language-filter").onchange = renderSites;
  $("btn-back").onclick = () => {
    if (webview.canGoBack()) webview.goBack();
  };
  $("btn-forward").onclick = () => {
    if (webview.canGoForward()) webview.goForward();
  };
  $("btn-reload").onclick = () => {
    if (!$("player-view").hidden) webview.reloadIgnoringCache();
  };
  $("btn-clear-cache").onclick = async () => {
    try {
      await api.clearCache();
      toast("Temporary movie data cleared.");
    } catch (err) {
      toast(err.message);
    }
  };
  $("btn-theater").onclick = () => {
    theater = !theater;
    document.body.classList.toggle("theater", theater);
    toast(theater ? "Theater mode on" : "Theater mode off");
  };
  $("btn-fullscreen").onclick = () => api.toggleFullscreen();
  webview.addEventListener("did-start-loading", () =>
    $("loading-bar").classList.add("loading"),
  );
  function loaded() {
    $("loading-bar").classList.remove("loading");
    const url = webview.getURL();
    if (url !== "about:blank") $("url-input").value = url;
    $("btn-back").disabled = !webview.canGoBack();
    $("btn-forward").disabled = !webview.canGoForward();
  }
  webview.addEventListener("did-finish-load", loaded);
  webview.addEventListener("dom-ready", loaded);
  webview.addEventListener("did-stop-loading", loaded);
  webview.addEventListener("page-title-updated", (event) => {
    if (!$("player-view").hidden) document.title = event.title || "CineStream";
  });
  webview.addEventListener("did-fail-load", (e) => {
    if (!e.isMainFrame) return;
    loaded();
    if (e.errorCode !== -3)
      toast("This provider could not load: " + e.errorDescription);
  });
  api.onBlockEvent((stats) => {
    $("blocked-count").textContent = stats.adsBlocked + stats.popupsBlocked;
  });
  api.onNavigationError((message) => toast(message));
  api.onLocked((result) => {
    state = result.user ? result : { user: null, access: null };
    $("account-label").textContent = state.user?.name || "Account";
    $("account-avatar").textContent = state.user?.name?.trim().charAt(0).toUpperCase() || "A";
    home(false);
    showAccount();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      api.toggleFullscreen();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      $("url-input").focus();
      $("url-input").select();
    }
    if ((e.ctrlKey && e.key.toLowerCase() === "r") || e.key === "F5") {
      e.preventDefault();
      if (!$("player-view").hidden) webview.reloadIgnoringCache();
    }
    if (e.altKey && e.key === "Home") {
      e.preventDefault();
      home();
    }
    if (e.key === "Escape") {
      theater = false;
      document.body.classList.remove("theater");
    }
  });
  setMode("login");
  try {
    await applyState(await api.getAccount());
    const stats = await api.getBlockStats();
    $("blocked-count").textContent = stats.adsBlocked + stats.popupsBlocked;
  } catch (err) {
    showAccount();
    $("account-error").textContent = err.message;
  }
});
