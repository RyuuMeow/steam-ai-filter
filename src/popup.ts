(() => {
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const input = $<HTMLInputElement>("#strength"), control = $(".filter-control");
  const autoIgnore = $<HTMLInputElement>("#auto-ignore"), showChecked = $<HTMLInputElement>("#show-checked");
  const error = $("#error"), status = $("#status"), pageStatus = $("#page-status"), coverage = $("#coverage");
  const reveal = $<HTMLButtonElement>("#reveal"), ignoreStatus = $("#ignore-status");
  const categoryToggles = new Map<SAF.FilterCategory, HTMLInputElement>();
  for (const category of SAF.filterCategories) {
    const label = document.createElement("label"), text = document.createElement("span"), toggle = document.createElement("input");
    label.className = "toggle-row"; label.htmlFor = `filter-${category}`;
    text.textContent = SAF.categoryLabel(category);
    toggle.id = `filter-${category}`; toggle.type = "checkbox"; toggle.setAttribute("role", "switch"); toggle.disabled = true;
    if (category === "unknown") label.title = "已取得 AI 揭露，但無法判定具體用途。";
    label.append(text, toggle); $("#category-list").append(label); categoryToggles.set(category, toggle);
  }
  const fields = {cacheDays: $<HTMLSelectElement>("#cache-days"), requestGap: $<HTMLSelectElement>("#request-gap"), concurrency: $<HTMLSelectElement>("#concurrency")};
  const titles: Record<string, string> = {home: "AI 過濾", settings: "設定", checking: "檢查與快取", network: "網路設定", display: "顯示設定", automation: "自動化與例外"};
  const routes: {view: string; scroll: number; trigger?: HTMLElement}[] = [{view: "home", scroll: 0}];
  function navigate(view?: string, trigger?: HTMLElement) {
    const current = routes[routes.length - 1];
    current.scroll = window.scrollY;
    const leaving = view ? undefined : routes.pop();
    if (view) routes.push({view, scroll: 0, trigger});
    const next = routes[routes.length - 1];
    for (const section of document.querySelectorAll<HTMLElement>("main > section[data-view]")) section.hidden = section.dataset.view !== next.view;
    $("#back").hidden = next.view === "home"; $("#settings").hidden = next.view !== "home";
    $("#page-title").textContent = titles[next.view];
    document.documentElement.dataset.view = next.view;
    (leaving?.trigger || $("#page-title")).focus({preventScroll: true});
    window.scrollTo(0, next.scroll);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open]")) button.onclick = () => navigate(button.dataset.open!, button);
  $("#back").onclick = () => { if (routes.length > 1) navigate(); };
  let settings = SAF.normalizeSettings(), ignoreState: Partial<SAFIgnore.State> = {};
  let tabId: number | undefined, isStoreTab = false, settingsRevision = 0;
  let writeQueue = Promise.resolve();
  function report(e: unknown) {
    console.error("Steam AI Filter:", e);
    error.hidden = false; error.textContent = "設定未能儲存，請再試一次。";
  }
  function paintMode(mode: SAF.Mode) {
    const index = SAF.modes.findIndex(item => item.id === mode);
    control.dataset.level = String(index); control.style.setProperty("--fraction", String(index / 3));
    input.value = String(index); input.setAttribute("aria-valuetext", SAF.modes[index].name);
    $("#rule-text").textContent = SAF.modes[index].description;
  }
  function paint() {
    paintMode(settings.mode);
    for (const [category, toggle] of categoryToggles) toggle.checked = settings.filterCategories[category];
    autoIgnore.checked = settings.autoIgnore; showChecked.checked = settings.showChecked;
    for (const [key, field] of Object.entries(fields)) field.value = String(settings[key as keyof typeof fields]);
    $("#cache-help").textContent = settings.cacheDays === 0
      ? "預設：有揭露 7 天，未找到揭露 1 天。過期後，下次遇到遊戲時重新檢查。"
      : `成功查詢的結果保留 ${settings.cacheDays} 天。過期後，下次遇到遊戲時重新檢查；失敗會較早重試。`;
    paintIgnore();
  }
  function paintIgnore() {
    ignoreStatus.hidden = !settings.autoIgnore;
    if (ignoreState.paused) ignoreStatus.textContent = ignoreState.paused;
    else if (!SAF.filters(settings.mode)) ignoreStatus.textContent = "自動不感興趣已隨過濾暫停。";
    else if ((ignoreState.cooldownUntil || 0) > Date.now()) ignoreStatus.textContent = `Steam 限流，${new Date(ignoreState.cooldownUntil!).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})} 後重試。`;
    else ignoreStatus.textContent = `待忽略 ${ignoreState.queue?.length || 0} 款 · 已確認忽略 ${Object.keys(ignoreState.done || {}).length} 款${ignoreState.last ? `\n${ignoreState.last}` : ""}`;
  }
  function renderAllow() {
    const entries = Object.entries(settings.allow);
    $("#exceptions").hidden = entries.length === 0; $("#allow-count").textContent = `(${entries.length})`;
    const list = $("#allow-list"); list.replaceChildren();
    for (const [id, title] of entries) {
      const li = document.createElement("li"), text = document.createElement("span"), button = document.createElement("button");
      text.textContent = title; button.textContent = "移除"; button.className = "text-button";
      button.setAttribute("aria-label", `移除 ${title} 的永遠顯示設定`);
      button.onclick = () => {
        button.disabled = true;
        save(latest => { const allow = {...latest.allow}; delete allow[id]; return {allow}; });
      };
      li.append(text, button); list.append(li);
    }
  }
  async function refresh() {
    if (tabId === undefined) return;
    try {
      const data: SAF.Status = await chrome.tabs.sendMessage(tabId, {type: "SAF_STATUS"});
      if (!data || !["app", "home", "search", "store"].includes(data.kind)) throw new Error("Unsupported page");
      pageStatus.hidden = settings.mode === "off";
      const action = data.presentation === "remove" ? "隱藏" : "遮蔽";
      status.textContent = data.total === 0 ? "本頁未找到可識別的遊戲卡片。" : data.kind === "app"
        ? `${data.mainMatched ? "這款遊戲符合所選用途" : "這款遊戲未命中所選用途"}${data.hidden ? `；其他遊戲已${action} ${data.hidden} 筆` : ""}`
        : data.revealing ? `暫時顯示全部 ${data.total} 筆`
        : settings.mode === "mark" ? `已標記 ${data.matched} / ${data.total} 筆` : `已${action} ${data.hidden} / ${data.total} 筆`;
      reveal.hidden = data.hidden === 0 && !data.revealing; reveal.textContent = data.revealing ? "恢復過濾" : "暫時顯示";
      coverage.hidden = settings.mode === "off";
      coverage.textContent = `檢查中 ${data.pending || 0} 筆；未找到揭露 ${data.checked || 0} 筆；尚未確認 ${data.unknown} 筆。`;
    } catch {
      pageStatus.hidden = !isStoreTab || settings.mode === "off";
      status.textContent = "重新整理 Steam 頁面以套用過濾。"; reveal.hidden = true; coverage.hidden = true;
    }
  }
  async function refreshPage() {
    if (tabId !== undefined) {
      try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REFRESH"}); }
      catch { /* refresh displays disconnected-page feedback */ }
    }
    await refresh();
  }
  function save(update: Partial<SAF.Settings> | ((latest: SAF.Settings) => Partial<SAF.Settings>)) {
    writeQueue = writeQueue.then(async () => {
      const stored = await chrome.storage.local.get(SAF.settingKeys);
      const latest = SAF.normalizeSettings(stored);
      const patch = typeof update === "function" ? update(latest) : update;
      // Atomically adopt the new schema on the first edit; legacy reads are pure and idempotent.
      const migration = stored.mode === undefined ? {mode: latest.mode} : {};
      await chrome.storage.local.set({settingsVersion: 2, ...migration, ...patch});
      settings = await SAF.getSettings(); error.hidden = true; paint(); renderAllow(); await refreshPage();
    }).catch(async e => {
      try { settings = await SAF.getSettings(); } catch { /* retain the last committed snapshot */ }
      paint(); renderAllow(); report(e);
    });
  }
  const selectedMode = () => SAF.modes[Number(input.value)]?.id || "mask";
  input.addEventListener("input", () => paintMode(selectedMode()));
  input.addEventListener("change", () => save({mode: selectedMode()}));
  for (const [category, toggle] of categoryToggles) toggle.addEventListener("change", () => {
    const checked = toggle.checked;
    save(latest => ({filterCategories: {...latest.filterCategories, [category]: checked}}));
  });
  for (const [key, field] of Object.entries(fields)) field.addEventListener("change", () => save({[key]: Number(field.value)}));
  showChecked.addEventListener("change", () => save({showChecked: showChecked.checked}));
  autoIgnore.addEventListener("change", () => {
    const enabled = autoIgnore.checked; autoIgnore.disabled = true;
    writeQueue = writeQueue.then(async () => {
      if (enabled) {
        const result = await chrome.runtime.sendMessage({type: "SAF_IGNORE_ENABLE"});
        if (!result?.ok) throw new Error(result?.issue || "無法開啟自動不感興趣。");
      } else await chrome.storage.local.set({autoIgnore: false});
      settings = await SAF.getSettings();
      await chrome.storage.local.set({ignoreError: ""});
      error.hidden = true; paint(); await refreshPage();
    }).catch(async e => {
      try { settings = await SAF.getSettings(); } catch { /* retain committed values */ }
      paint(); error.hidden = false; error.textContent = e instanceof Error ? e.message : "設定未能儲存，請再試一次。";
    }).finally(() => { autoIgnore.disabled = false; });
  });
  reveal.onclick = async () => {
    if (tabId === undefined) return;
    try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REVEAL"}); await refresh(); }
    catch { pageStatus.hidden = false; status.textContent = "頁面連線已中斷，請重新整理。"; }
  };
  $<HTMLButtonElement>("#clear-cache").onclick = async event => {
    const button = event.currentTarget as HTMLButtonElement, resultText = $("#cache-result");
    button.disabled = true; resultText.hidden = true;
    try {
      const result = await chrome.runtime.sendMessage({type: "SAF_CLEAR_CACHE"});
      if (!result?.ok) throw new Error("Cache clear failed");
      resultText.textContent = "查詢快取已清除。"; resultText.dataset.error = "false"; await refresh();
    } catch { resultText.textContent = "清除失敗，請再試一次。"; resultText.dataset.error = "true"; }
    finally { button.disabled = false; resultText.hidden = false; }
  };
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "SAF_UPDATED" && sender.tab?.id === tabId) void refresh();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (SAF.settingKeys.some(key => changes[key])) {
      const revision = ++settingsRevision;
      void SAF.getSettings().then(next => {
        if (revision !== settingsRevision) return;
        settings = next; paint(); if (changes.allow) renderAllow(); void refresh();
      }).catch(report);
    }
    if (changes.ignoreState) { ignoreState = changes.ignoreState.newValue || {}; paintIgnore(); }
    if (typeof changes.ignoreError?.newValue === "string" && changes.ignoreError.newValue) { error.hidden = false; error.textContent = changes.ignoreError.newValue; }
  });
  void (async () => {
    try {
      settings = await SAF.getSettings();
      const stored = await chrome.storage.local.get(["ignoreState", "ignoreError"]);
      ignoreState = stored.ignoreState || {}; paint(); renderAllow();
      if (typeof stored.ignoreError === "string" && stored.ignoreError) { error.hidden = false; error.textContent = stored.ignoreError; }
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      isStoreTab = Boolean(tab?.url?.startsWith("https://store.steampowered.com/")); tabId = tab?.id;
      await refresh();
      for (const element of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, #clear-cache")) element.disabled = false;
    } catch (e) { report(e); }
  })();
})();
