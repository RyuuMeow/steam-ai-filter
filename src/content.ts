(() => {
  const appMatch = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
  const isSearch = /^\/search\/?$/.test(location.pathname);
  if (!appMatch && !isSearch) return;
  if (document.getElementById("saf-root")) return;
  let settings: SAF.Settings = {level: 1, allow: {}};
  let revealing = false;
  let ready = false;
  let timer = 0;
  let currentDialog: SAF.Evidence | null = null;
  let previousStatus = "";
  let status: SAF.Status = {kind: isSearch ? "search" : "app", total: 0, hidden: 0, matched: 0, unknown: 0, revealing};
  const entries = new Map<Element, SAF.Evidence>();
  const dirty = new Set<Element>();
  const host = document.createElement("div");
  host.id = "saf-root";
  const shadow = host.attachShadow({mode: "open"});
  shadow.innerHTML = `
    <style>
      :host{display:block;clear:both;margin:12px 0;font:14px/1.5 "Segoe UI","Microsoft JhengHei",sans-serif;color:#d6e4f1}
      *{box-sizing:border-box} [hidden]{display:none!important}
      .bar{padding:12px 16px;background:#1c2d3c;border:1px solid #3a5368;border-radius:8px}
      .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .row strong{font-weight:600}
      .note{color:#afc4d7;font-size:12px;margin:6px 0 0}
      button{font:inherit;color:#a6ddff;cursor:pointer;background:transparent;border:0;padding:4px 0;text-align:left}
      button:hover{text-decoration:underline} button:focus-visible,summary:focus-visible{outline:2px solid #80d7ff;outline-offset:3px}
      summary{cursor:pointer;margin-top:8px} ul{list-style:none;margin:8px 0 0;padding:0;max-height:240px;overflow:auto}
      li{border-top:1px solid #3a5368;padding:6px 0} .error{color:#ffbcbc}
      dialog{width:min(480px,calc(100vw - 32px));max-height:80vh;overflow:auto;border:0;border-radius:16px;padding:24px;background:#fff;color:#222435;box-shadow:0 10px 35px #0005}
      dialog::backdrop{background:#101a25aa} dialog h2{font-size:18px;margin:0 0 12px} dialog p{white-space:pre-wrap;overflow-wrap:anywhere}
      dialog button{color:#0053ea} .actions{display:flex;justify-content:space-between;gap:16px;margin-top:24px}
    </style>
    <section class="bar" hidden>
      <div class="row"><strong>AI 過濾</strong><span id="stat"></span><button id="reveal" hidden>暫時顯示</button></div>
      <p class="note" id="note"></p>
      <details id="matches" hidden><summary>查看命中原因與例外</summary><ul id="list"></ul></details>
      <p class="error" id="error" role="alert" hidden></p>
    </section>
    <dialog aria-labelledby="dialog-title">
      <h2 id="dialog-title"></h2><strong id="reason"></strong><p id="evidence"></p>
      <div class="actions"><button id="allow"></button><button id="close">關閉</button></div>
    </dialog>`;
  const bar = shadow.querySelector<HTMLElement>(".bar")!;
  const stat = shadow.querySelector<HTMLElement>("#stat")!;
  const note = shadow.querySelector<HTMLElement>("#note")!;
  const reveal = shadow.querySelector<HTMLButtonElement>("#reveal")!;
  const list = shadow.querySelector<HTMLElement>("#list")!;
  const dialog = shadow.querySelector<HTMLDialogElement>("dialog")!;
  const allowButton = shadow.querySelector<HTMLButtonElement>("#allow")!;
  function report(e: unknown) {
    console.error("Steam AI Filter:", e);
    bar.hidden = false;
    const error = shadow.querySelector<HTMLElement>("#error")!;
    error.hidden = false; error.textContent = "設定讀取或儲存失敗，請重新整理後再試。";
  }
  function placeHost(): boolean {
    if (isSearch) {
      const target = document.querySelector("#search_resultsRows");
      if (!target) return false;
      if (!host.isConnected) target.before(host);
    } else {
      const title = document.querySelector("#appHubAppName, .apphub_AppName");
      if (!title) return false;
      if (!host.isConnected) title.parentElement!.after(host);
    }
    return true;
  }
  function openReason(e: SAF.Evidence) {
    currentDialog = e;
    shadow.querySelector("#dialog-title")!.textContent = e.title;
    shadow.querySelector("#reason")!.textContent = SAF.reason(e);
    shadow.querySelector("#evidence")!.textContent = e.disclosure
      ? `開發者揭露原文：\n\n${e.disclosure}${e.tagMatch ? "\n\n亦命中「人工智慧」標籤；標籤可能只代表遊戲題材。" : ""}`
      : "此遊戲的頁面資料帶有「人工智慧 / Artificial Intelligence」標籤。這可能描述遊戲題材，不能證明使用生成式 AI 製作。";
    allowButton.textContent = Object.hasOwn(settings.allow, e.id) ? "取消永遠顯示" : "永遠顯示這款遊戲";
    if (!dialog.open) dialog.showModal();
  }
  shadow.querySelector<HTMLButtonElement>("#close")!.onclick = () => dialog.close();
  allowButton.onclick = async () => {
    if (!currentDialog) return;
    allowButton.disabled = true;
    try {
      const latest = await SAF.getSettings();
      if (Object.hasOwn(latest.allow, currentDialog.id)) delete latest.allow[currentDialog.id];
      else latest.allow[currentDialog.id] = currentDialog.title;
      await chrome.storage.local.set({allow: latest.allow});
      settings.allow = latest.allow; render(); openReason(currentDialog);
    } catch (e) { report(e); }
    finally { allowButton.disabled = false; }
  };
  reveal.onclick = () => { revealing = !revealing; render(); };
  function render() {
    let hidden = 0, matched = 0, unknown = 0;
    const candidates = new Map<string, SAF.Evidence>();
    for (const [element, evidence] of entries) {
      const match = Boolean(evidence.disclosure || evidence.tagMatch);
      if (match) { matched++; candidates.set(evidence.id, evidence); } else unknown++;
      const hide = isSearch && !revealing && SAF.shouldHide(evidence, settings.level, settings.allow);
      if (hide) hidden++;
      if (isSearch) {
        element.classList.toggle("saf-hidden", hide);
        const existing = element.querySelector<HTMLElement>(".saf-badge");
        if (settings.level === 0 || !match) existing?.remove();
        else {
          const badge = existing || document.createElement("span");
          const text = SAF.reason(evidence) + (Object.hasOwn(settings.allow, evidence.id) ? " · 永遠顯示" : "");
          if (badge.textContent !== text) badge.textContent = text;
          if (!existing) {
            badge.className = "saf-badge"; badge.tabIndex = 0; badge.setAttribute("role", "button");
            const show = (event: Event) => {
              event.preventDefault(); event.stopPropagation();
              const latest = entries.get(element);
              if (latest) openReason(latest);
            };
            badge.onclick = show;
            badge.onkeydown = event => { if (event.key === "Enter" || event.key === " ") show(event); };
            (element.querySelector(".search_name") || element).append(badge);
          }
        }
      }
    }
    status = {kind: isSearch ? "search" : "app", total: entries.size, hidden, matched, unknown, revealing};
    bar.hidden = settings.level === 0;
    host.style.display = settings.level === 0 ? "none" : "";
    if (settings.level === 0 && dialog.open) dialog.close();
    stat.textContent = isSearch
      ? revealing ? `暫時顯示全部 ${entries.size} 筆` : `已隱藏 ${hidden} / ${entries.size} 筆`
      : matched ? "這款遊戲有符合的訊號" : "本頁未取得 AI 使用訊號";
    const issues = Array.from(entries.values()).filter(e => e.parseIssue).length;
    note.textContent = isSearch
      ? `僅依本頁資料判斷；${unknown} 筆資訊不足。搜尋卡片可能沒有完整標籤或 AI 揭露。${issues ? ` ${issues} 筆標籤格式無法讀取。` : ""}`
      : "詳情頁保留供你查看。未取得訊號不代表沒有使用 AI。";
    reveal.hidden = !isSearch || (hidden === 0 && !revealing);
    reveal.textContent = revealing ? "恢復過濾" : "暫時顯示";
    shadow.querySelector<HTMLElement>("#matches")!.hidden = candidates.size === 0;
    // Shadow-root updates do not feed the page observer.
    list.replaceChildren();
    for (const e of candidates.values()) {
      const li = document.createElement("li"), button = document.createElement("button");
      button.textContent = `${e.title} · ${SAF.reason(e)}${Object.hasOwn(settings.allow, e.id) ? " · 永遠顯示" : ""}`;
      button.onclick = () => openReason(e);
      li.append(button); list.append(li);
    }
    const signature = JSON.stringify(status);
    if (signature !== previousStatus) {
      previousStatus = signature;
      // A closed popup has no receiver; that is an expected state, not a filter failure.
      void chrome.runtime.sendMessage({type: "SAF_UPDATED", status}).catch(() => undefined);
    }
  }
  function scan() {
    timer = 0;
    if (!ready || !placeHost()) return;
    if (isSearch) {
      const cards = new Set(document.querySelectorAll("#search_resultsRows a.search_result_row"));
      for (const element of entries.keys()) {
        if (!cards.has(element)) { element.classList.remove("saf-hidden"); element.querySelector(".saf-badge")?.remove(); entries.delete(element); }
      }
      for (const card of cards) {
        if (entries.has(card) && !dirty.has(card)) continue;
        const id = card.getAttribute("data-ds-appid") || new URL((card as HTMLAnchorElement).href).pathname.match(/^\/app\/(\d+)/)?.[1];
        if (!id || !/^\d+$/.test(id)) {
          card.classList.remove("saf-hidden"); card.querySelector(".saf-badge")?.remove();
          entries.delete(card); continue; // bundles and packages aren't a single game
        }
        const title = card.querySelector(".title")?.textContent?.trim() || `App ${id}`;
        entries.set(card, SAF.readEvidence(card, id, title));
      }
    } else {
      entries.clear();
      entries.set(document.documentElement, SAF.readEvidence(document, appMatch![1],
        document.querySelector("#appHubAppName, .apphub_AppName")?.textContent?.trim() || `App ${appMatch![1]}`));
    }
    dirty.clear(); render();
  }
  function schedule() { if (!timer) timer = window.setTimeout(scan, 100); }
  const observer = new MutationObserver(records => {
    let relevant = false;
    for (const record of records) {
      const el = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!el || el.closest("#saf-root, .saf-badge")) continue;
      if (record.type === "childList") {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.length && nodes.every(n => n instanceof Element && (n.id === "saf-root" || n.classList.contains("saf-badge")))) continue;
      }
      relevant = true;
      const card = el.closest(".search_result_row");
      if (card) dirty.add(card);
    }
    if (relevant) schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.level) { settings.level = SAF.normalizeLevel(changes.level.newValue); revealing = false; }
    if (changes.allow) settings.allow = SAF.cleanAllow(changes.allow.newValue);
    if (ready) render();
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!message || !["SAF_STATUS", "SAF_REFRESH", "SAF_REVEAL"].includes(message.type)) return;
    if (!ready || !host.isConnected) { respond(null); return; }
    if (message.type === "SAF_REFRESH") {
      SAF.getSettings().then(data => { settings = data; render(); respond(status); }).catch(e => { report(e); respond(null); });
      return true;
    }
    if (message.type === "SAF_REVEAL") { revealing = !revealing; render(); }
    respond(status);
  });
  void SAF.getSettings().then(data => {
    settings = data; ready = true; scan();
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["data-ds-tagids", "data-ds-appid", "href"]
    });
  }).catch(e => { placeHost(); report(e); });
})();
