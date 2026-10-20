(() => {
  const input = document.querySelector<HTMLInputElement>("#strength")!;
  const card = document.querySelector<HTMLElement>(".filter-card")!;
  const label = document.querySelector<HTMLElement>("#level-name")!;
  const rule = document.querySelector<HTMLElement>("#rule")!;
  const status = document.querySelector<HTMLElement>("#status")!;
  const coverage = document.querySelector<HTMLElement>("#coverage")!;
  const reveal = document.querySelector<HTMLButtonElement>("#reveal")!;
  const error = document.querySelector<HTMLElement>("#error")!;
  let settings: SAF.Settings = {level: 1, allow: {}};
  let tabId: number | undefined;
  let writeQueue = Promise.resolve();
  function report(e: unknown) {
    console.error("Steam AI Filter:", e);
    error.hidden = false;
    error.textContent = "設定未能儲存，請重新開啟插件再試。";
  }
  function paint(level: SAF.Level) {
    const changed = card.dataset.level !== String(level);
    card.dataset.level = String(level);
    card.style.setProperty("--fraction", String(level / 3));
    input.value = String(level);
    label.textContent = SAF.levels[level].name;
    rule.textContent = SAF.levels[level].description;
    input.setAttribute("aria-valuetext", SAF.levels[level].name);
    if (changed) {
      card.classList.remove("sweep");
      requestAnimationFrame(() => card.classList.add("sweep"));
    }
  }
  function renderAllow() {
    const entries = Object.entries(settings.allow);
    document.querySelector<HTMLElement>("#exceptions")!.hidden = entries.length === 0;
    document.querySelector("#allow-count")!.textContent = `(${entries.length})`;
    const list = document.querySelector("#allow-list")!;
    list.replaceChildren();
    for (const [id, title] of entries) {
      const li = document.createElement("li"), text = document.createElement("span");
      const button = document.createElement("button");
      text.textContent = title;
      button.textContent = "移除"; button.className = "text-button";
      button.setAttribute("aria-label", `移除 ${title} 的永遠顯示設定`);
      button.onclick = async () => {
        button.disabled = true;
        try {
          const latest = await SAF.getSettings();
          delete latest.allow[id];
          await chrome.storage.local.set({allow: latest.allow});
          settings.allow = latest.allow; renderAllow(); await refresh();
        } catch (e) { report(e); button.disabled = false; }
      };
      li.append(text, button); list.append(li);
    }
  }
  async function refresh() {
    if (tabId === undefined) return;
    try {
      const data: SAF.Status = await chrome.tabs.sendMessage(tabId, {type: "SAF_STATUS"});
      if (!data || !["app", "home", "search"].includes(data.kind)) throw new Error("Unsupported page");
      status.textContent = data.kind === "app"
        ? (data.matched ? "這款遊戲有符合的訊號" : "本頁未取得 AI 使用訊號")
        : data.revealing ? `暫時顯示全部 ${data.total} 筆` : `本頁已遮蔽 ${data.hidden} / ${data.total} 筆`;
      reveal.hidden = data.kind === "app" || (data.hidden === 0 && !data.revealing);
      reveal.textContent = data.revealing ? "恢復過濾" : "暫時顯示";
      coverage.hidden = false;
      coverage.textContent = data.kind !== "app"
        ? `背景確認 ${data.pending || 0} 筆；${data.checked || 0} 筆未找到披露；${data.unknown} 筆尚未確認。`
        : "未取得訊號不代表沒有使用 AI。";
    } catch {
      status.textContent = "請開啟或重新整理 Steam 首頁／搜尋／遊戲頁。";
      reveal.hidden = true; coverage.hidden = true;
    }
  }
  input.addEventListener("input", () => paint(SAF.normalizeLevel(Number(input.value))));
  input.addEventListener("change", () => {
    const level = SAF.normalizeLevel(Number(input.value));
    writeQueue = writeQueue.then(async () => {
      await chrome.storage.local.set({level});
      settings.level = level; error.hidden = true;
      // Ask the page to reload settings so the count reflects the committed value.
      if (tabId !== undefined) {
        try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REFRESH"}); }
        catch { /* refresh below displays unsupported/disconnected status */ }
      }
      await refresh();
    }).catch(report);
  });
  reveal.onclick = async () => {
    if (tabId === undefined) return;
    try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REVEAL"}); await refresh(); }
    catch { status.textContent = "頁面連線已中斷，請重新整理。"; }
  };
  document.querySelector<HTMLButtonElement>("#clear-cache")!.onclick = async event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({type: "SAF_CLEAR_CACHE"});
      if (!result?.ok) throw new Error("Cache clear failed");
      button.textContent = "查詢快取已清除";
      await refresh();
    } catch { button.textContent = "清除失敗，請再試一次"; }
    finally { button.disabled = false; }
  };
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "SAF_UPDATED" && sender.tab?.id === tabId) void refresh();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.level) {
      settings.level = SAF.normalizeLevel(changes.level.newValue);
      if (document.activeElement !== input) paint(settings.level);
    }
    if (changes.allow) { settings.allow = SAF.cleanAllow(changes.allow.newValue); renderAllow(); }
  });
  input.disabled = true;
  void (async () => {
    try {
      settings = await SAF.getSettings(); paint(settings.level); renderAllow();
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      tabId = tab?.id; await refresh(); input.disabled = false;
    } catch (e) { report(e); status.textContent = "插件初始化失敗，請重新開啟。"; }
  })();
})();
