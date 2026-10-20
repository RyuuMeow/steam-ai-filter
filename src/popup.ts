(() => {
  const input = document.querySelector<HTMLInputElement>("#strength")!;
  const control = document.querySelector<HTMLElement>(".filter-control")!;
  const rule = document.querySelector<HTMLElement>("#rule")!;
  const presentationControl = document.querySelector<HTMLElement>("#presentation")!;
  const presentations = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="presentation"]'));
  const codeOption = document.querySelector<HTMLElement>("#code-option")!;
  const acceptCode = document.querySelector<HTMLInputElement>("#accept-ai-code")!;
  const pageStatus = document.querySelector<HTMLElement>("#page-status")!;
  const status = document.querySelector<HTMLElement>("#status")!;
  const coverage = document.querySelector<HTMLElement>("#coverage")!;
  const reveal = document.querySelector<HTMLButtonElement>("#reveal")!;
  const error = document.querySelector<HTMLElement>("#error")!;
  let settings: SAF.Settings = {level: 1, presentation: "mask", acceptAICode: true, allow: {}};
  let tabId: number | undefined;
  let isStoreTab = false;
  let writeQueue = Promise.resolve();
  function report(e: unknown) {
    console.error("Steam AI Filter:", e);
    error.hidden = false;
    error.textContent = "設定未能儲存，請重新開啟插件再試。";
  }
  function paint(level: SAF.Level) {
    const changed = control.dataset.level !== String(level);
    control.dataset.level = String(level);
    control.style.setProperty("--fraction", String(level / 3));
    input.value = String(level);
    rule.textContent = SAF.levels[level].description.replace("遮蔽", settings.presentation === "remove" ? "剔除" : "遮蔽");
    presentationControl.hidden = level < 2;
    codeOption.hidden = level < 2;
    acceptCode.checked = settings.acceptAICode;
    for (const radio of presentations) radio.checked = radio.value === settings.presentation;
    input.setAttribute("aria-valuetext", SAF.levels[level].name);
    if (changed) {
      control.classList.remove("sweep");
      requestAnimationFrame(() => control.classList.add("sweep"));
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
      if (!data || !["app", "home", "search", "store"].includes(data.kind)) throw new Error("Unsupported page");
      pageStatus.hidden = settings.level === 0;
      const action = data.presentation === "remove" ? "剔除" : "遮蔽";
      status.textContent = data.total === 0 ? "本頁未找到可識別的遊戲卡片。" : data.kind === "app"
        ? `${data.mainMatched ? "這款遊戲有符合的訊號" : "本頁未取得 AI 使用訊號"}${data.hidden ? `；其他遊戲已${action} ${data.hidden} 筆` : ""}`
        : data.revealing ? `暫時顯示全部 ${data.total} 筆`
        : settings.level === 1 ? `已標示 ${data.matched} / ${data.total} 筆` : `已${action} ${data.hidden} / ${data.total} 筆`;
      reveal.hidden = data.hidden === 0 && !data.revealing;
      reveal.textContent = data.revealing ? "恢復過濾" : "暫時顯示";
      coverage.hidden = settings.level === 0;
      coverage.textContent = data.kind !== "app"
        ? `背景確認 ${data.pending || 0} 筆；${data.checked || 0} 筆未找到披露；${data.unknown} 筆尚未確認。`
        : "未取得訊號不代表沒有使用 AI。";
    } catch {
      pageStatus.hidden = !isStoreTab || settings.level === 0;
      status.textContent = "重新整理 Steam 頁面以套用過濾。";
      reveal.hidden = true; coverage.hidden = true;
    }
  }
  function save(update: Partial<Pick<SAF.Settings, "level" | "presentation" | "acceptAICode">>) {
    writeQueue = writeQueue.then(async () => {
      await chrome.storage.local.set(update);
      Object.assign(settings, update); error.hidden = true; paint(settings.level);
      // Ask the page to reload settings so the count reflects the committed value.
      if (tabId !== undefined) {
        try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REFRESH"}); }
        catch { /* refresh below displays unsupported/disconnected status */ }
      }
      await refresh();
    }).catch(e => { paint(settings.level); report(e); });
  }
  input.addEventListener("input", () => paint(SAF.normalizeLevel(Number(input.value))));
  input.addEventListener("change", () => save({level: SAF.normalizeLevel(Number(input.value))}));
  for (const radio of presentations) radio.addEventListener("change", () => {
    if (radio.checked) save({presentation: SAF.normalizePresentation(radio.value)});
  });
  acceptCode.addEventListener("change", () => save({acceptAICode: acceptCode.checked}));
  reveal.onclick = async () => {
    if (tabId === undefined) return;
    try { await chrome.tabs.sendMessage(tabId, {type: "SAF_REVEAL"}); await refresh(); }
    catch { pageStatus.hidden = false; status.textContent = "頁面連線已中斷，請重新整理。"; }
  };
  document.querySelector<HTMLButtonElement>("#clear-cache")!.onclick = async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const resultText = document.querySelector<HTMLElement>("#cache-result")!;
    button.disabled = true;
    resultText.hidden = true;
    try {
      const result = await chrome.runtime.sendMessage({type: "SAF_CLEAR_CACHE"});
      if (!result?.ok) throw new Error("Cache clear failed");
      resultText.textContent = "查詢快取已清除。";
      resultText.dataset.error = "false";
      await refresh();
    } catch {
      resultText.textContent = "清除失敗，請再試一次。";
      resultText.dataset.error = "true";
    } finally { button.disabled = false; resultText.hidden = false; }
  };
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "SAF_UPDATED" && sender.tab?.id === tabId) void refresh();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.level) {
      settings.level = SAF.normalizeLevel(changes.level.newValue);
      if (document.activeElement !== input) paint(settings.level);
      void refresh();
    }
    if (changes.allow) { settings.allow = SAF.cleanAllow(changes.allow.newValue); renderAllow(); }
    if (changes.presentation) {
      settings.presentation = SAF.normalizePresentation(changes.presentation.newValue);
      paint(settings.level); void refresh();
    }
    if (changes.acceptAICode) {
      settings.acceptAICode = SAF.normalizeAcceptAICode(changes.acceptAICode.newValue);
      paint(settings.level); void refresh();
    }
  });
  input.disabled = true;
  for (const radio of presentations) radio.disabled = true;
  acceptCode.disabled = true;
  void (async () => {
    try {
      settings = await SAF.getSettings(); paint(settings.level); renderAllow();
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      isStoreTab = Boolean(tab?.url?.startsWith("https://store.steampowered.com/"));
      tabId = tab?.id; await refresh(); input.disabled = false;
      for (const radio of presentations) radio.disabled = false;
      acceptCode.disabled = false;
    } catch (e) { report(e); }
  })();
})();
