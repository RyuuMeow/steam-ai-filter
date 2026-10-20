(() => {
  let appMatch = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
  let kind = SAF.pageKind(location.pathname);
  if (document.getElementById("saf-root")) return;
  let settings: SAF.Settings = {level: 1, presentation: "mask", allow: {}};
  let revealing = false;
  let ready = false;
  let stopped = false;
  const events = new AbortController();
  let timer = 0;
  let currentDialog: SAF.Evidence | null = null;
  let previousStatus = "";
  let status: SAF.Status = {kind, total: 0, hidden: 0, matched: 0, unknown: 0, revealing, presentation: settings.presentation};
  const entries = new Map<Element, SAF.Evidence>();
  let effective = new Map<Element, SAF.Evidence>();
  const watched = new WeakSet<Element>();
  const dirty = new Set<Element>();
  const nearby = new Set<Element>();
  let remote = new Map<string, SAFLookup.Result>();
  const requesting = new Set<string>();
  let retryTimer = 0;
  const visibility = new IntersectionObserver(records => {
    if (!contextReady()) return;
    for (const record of records) {
      if (record.isIntersecting) nearby.add(record.target); else nearby.delete(record.target);
    }
    if (ready) render();
  }, {rootMargin: "400px"});
  function contextReady(): boolean {
    if (stopped) return false;
    try {
      if (chrome.runtime?.id) return true;
    } catch { stop(); return false; }
    stop(); return false;
  }
  function isInvalidated(error: unknown): boolean {
    return /extension context invalidated/i.test(String(error));
  }
  // Chrome can throw before returning a Promise, so attach the handler inside an async boundary.
  async function send(message: unknown): Promise<unknown> {
    if (!contextReady()) return undefined;
    try { return await chrome.runtime.sendMessage(message); }
    catch (error) {
      if (isInvalidated(error) || !contextReady()) { stop(); return undefined; }
      throw error;
    }
  }
  function readCache(value: unknown) {
    const cache = value as SAFLookup.Stored | undefined;
    remote = new Map(Object.entries(cache?.version === 1 ? cache.items || {} : {}).filter(
      ([id, result]) => SAFLookup.validId(id) && SAFLookup.fresh(result, Date.now()) && (result.state !== "unavailable" || cache?.sessionAware)));
  }
  function resultFor(id: string): SAFLookup.Result | undefined {
    const result = remote.get(id);
    return SAFLookup.fresh(result, Date.now()) ? result : undefined;
  }
  function requestNearby() {
    window.clearTimeout(retryTimer);
    if (!ready || !contextReady() || settings.level === 0 || document.hidden) return;
    const visibleEntries = [...nearby].filter(e => e.isConnected && entries.has(e));
    // Nearest cards are serviced first, independent of DOM/carousel order.
    visibleEntries.sort((a, b) => Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top));
    for (const element of visibleEntries) {
      const evidence = effective.get(element) || entries.get(element)!;
      if (requesting.size >= 2) break;
      if (evidence.disclosure || (settings.level === 3 && evidence.tagMatch) || Object.hasOwn(settings.allow, evidence.id) ||
          resultFor(evidence.id) || requesting.has(evidence.id)) continue;
      const id = evidence.id;
      requesting.add(id);
      void send({type: "SAF_LOOKUP", id}).then((result: unknown) => {
        if (!contextReady()) return;
        const reply = result as SAFLookup.Result | undefined;
        if (reply?.state === "unavailable" && reply.expiresAt <= reply.checkedAt) remote.delete(id);
        else remote.set(id, SAFLookup.fresh(result, Date.now()) ? result : SAFLookup.unavailable(Date.now(), "查詢未完成", 30000));
      }).catch(() => {
        if (!contextReady()) return;
        remote.set(id, SAFLookup.unavailable(Date.now(), "查詢服務無法使用", 60000));
      }).finally(() => { requesting.delete(id); if (contextReady()) render(); });
      if (stopped) return;
    }
    // Recheck expiration without rescanning the document. Hidden tabs issue no requests.
    retryTimer = window.setTimeout(() => render(), 30000);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearTimeout(retryTimer); else if (ready) render();
  }, {signal: events.signal});
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
  function stop() {
    if (stopped) return;
    stopped = true; ready = false;
    window.clearTimeout(timer); timer = 0;
    window.clearTimeout(retryTimer); retryTimer = 0;
    observer.disconnect(); visibility.disconnect(); events.abort();
    if (dialog.open) dialog.close();
    for (const element of entries.keys()) {
      if (element === document.documentElement) continue;
      SAF.syncMask(element, null);
      element.classList.remove("saf-badge-positioned");
      element.querySelector(".saf-badge")?.remove();
    }
    entries.clear(); effective.clear(); nearby.clear(); dirty.clear(); remote.clear(); requesting.clear();
    // Keep one recovery notice, with no dead buttons or obsolete counts.
    if (!host.isConnected) document.body.prepend(host);
    host.style.display = ""; bar.hidden = false;
    stat.textContent = "過濾已停止，請重新整理頁面。";
    note.hidden = true; reveal.hidden = true; allowButton.disabled = true;
    list.replaceChildren();
    shadow.querySelector<HTMLElement>("#matches")!.hidden = true;
    shadow.querySelector<HTMLElement>("#error")!.hidden = true;
  }
  function report(e: unknown) {
    if (isInvalidated(e) || !contextReady()) { stop(); return; }
    console.error("Steam AI Filter:", e);
    bar.hidden = false;
    const error = shadow.querySelector<HTMLElement>("#error")!;
    error.hidden = false; error.textContent = "設定讀取或儲存失敗，請重新整理後再試。";
  }
  function placeHost(): boolean {
    if (appMatch) {
      const title = document.querySelector("#appHubAppName, .apphub_AppName");
      if (title) {
        if (!host.isConnected) title.parentElement!.after(host);
        return true;
      }
    }
    if (!entries.size) return false;
    const search = document.querySelector("#search_resultsRows");
    const target = search || document.querySelector(".home_page_content, .responsive_page_template_content, main, [role=main]") || document.body;
    if (!host.isConnected) { if (search) search.before(host); else target.prepend(host); }
    return true;
  }
  function openReason(e: SAF.Evidence) {
    if (!contextReady()) return;
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
    if (!currentDialog || !contextReady()) return;
    allowButton.disabled = true;
    try {
      const latest = await SAF.getSettings();
      if (!contextReady()) return;
      if (Object.hasOwn(latest.allow, currentDialog.id)) delete latest.allow[currentDialog.id];
      else latest.allow[currentDialog.id] = currentDialog.title;
      await chrome.storage.local.set({allow: latest.allow});
      if (!contextReady()) return;
      settings.allow = latest.allow; render(); openReason(currentDialog);
    } catch (e) { report(e); }
    finally { if (!stopped) allowButton.disabled = false; }
  };
  reveal.onclick = () => { revealing = !revealing; render(); };
  function watchCard(card: Element) {
    if (watched.has(card)) return;
    watched.add(card);
    const activate = (event: Event) => {
      if (!card.classList.contains("saf-blocked")) return;
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const evidence = effective.get(card);
      if (evidence) openReason(evidence);
    };
    card.addEventListener("click", activate, {capture: true, signal: events.signal});
    card.addEventListener("auxclick", event => {
      if (card.classList.contains("saf-blocked")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, {capture: true, signal: events.signal});
    card.addEventListener("keydown", activate, {capture: true, signal: events.signal});
  }
  // Stop Steam hover previews for covered cards, including inline hover handlers.
  for (const type of ["mouseover", "mouseenter", "pointerover", "pointerenter", "focusin"]) {
    document.addEventListener(type, event => {
      if ((event.target as Element)?.closest?.(".saf-blocked")) event.stopImmediatePropagation();
    }, {capture: true, signal: events.signal});
  }
  document.addEventListener("play", event => {
    if (event.target instanceof HTMLMediaElement && event.target.closest(".saf-blocked, .saf-removed")) event.target.pause();
  }, {capture: true, signal: events.signal});
  function render() {
    if (!contextReady()) return;
    let hidden = 0, matched = 0, unknown = 0, pending = 0, checked = 0, failed = 0;
    const candidates = new Map<string, SAF.Evidence>();
    effective = SAF.mergeEvidence(entries);
    {
      for (const [element, evidence] of effective) {
        if (element === document.documentElement) continue;
        const result = resultFor(evidence.id);
        if (result?.state === "disclosed" && !evidence.disclosure) effective.set(element, {...evidence, disclosure: result.disclosure});
      }
    }
    requestNearby();
    if (stopped) return;
    for (const [element, evidence] of effective) {
      const isCard = element !== document.documentElement;
      const match = Boolean(evidence.disclosure || evidence.tagMatch);
      const result = isCard ? resultFor(evidence.id) : undefined;
      if (match) { matched++; candidates.set(evidence.id, evidence); }
      else if (result?.state === "not-found") checked++;
      else unknown++;
      if (requesting.has(evidence.id)) pending++;
      if (result?.state === "unavailable") failed++;
      const hide = isCard && !revealing && SAF.shouldHide(evidence, settings.level, settings.allow);
      if (hide) hidden++;
      if (isCard) {
        watchCard(element);
        SAF.syncMask(element, hide ? evidence : null, settings.presentation);
        const existing = element.querySelector<HTMLElement>(".saf-badge");
        const showBadge = settings.level !== 0 && match && !(hide && settings.presentation === "remove");
        if (!showBadge) existing?.remove();
        else {
          const badge = existing || document.createElement("span");
          const text = SAF.reason(evidence) + (Object.hasOwn(settings.allow, evidence.id) ? " · 永遠顯示" : "");
          if (badge.textContent !== text) badge.textContent = text;
          if (!existing) {
            badge.className = "saf-badge"; badge.tabIndex = 0; badge.setAttribute("role", "button");
            const show = (event: Event) => {
              event.preventDefault(); event.stopPropagation();
              const latest = effective.get(element);
              if (latest) openReason(latest);
            };
            badge.onclick = show;
            badge.onkeydown = event => { if (event.key === "Enter" || event.key === " ") show(event); };
            if (!element.matches(".search_result_row")) {
              badge.classList.add("saf-home-badge");
              if (getComputedStyle(element).position === "static") element.classList.add("saf-badge-positioned");
            }
            (element.querySelector(".search_name") || element).append(badge);
          }
        }
        // Include any newly inserted badge in the mask's accessibility suppression.
        if (hide && settings.presentation === "mask") SAF.syncMask(element, evidence);
        if (!showBadge) element.classList.remove("saf-badge-positioned");
      }
    }
    const main = entries.get(document.documentElement);
    const mainMatched = Boolean(main?.disclosure || main?.tagMatch);
    status = {kind, total: entries.size, hidden, matched, unknown, pending, checked, failed, mainMatched, revealing, presentation: settings.presentation};
    bar.hidden = settings.level === 0 || !entries.size;
    host.style.display = bar.hidden ? "none" : "";
    if (settings.level === 0 && dialog.open) dialog.close();
    const action = settings.presentation === "remove" ? "剔除" : "遮蔽";
    stat.textContent = main
      ? `${mainMatched ? "這款遊戲有符合的訊號" : "本頁未取得 AI 使用訊號"}${hidden ? `；其他遊戲已${action} ${hidden} 筆` : ""}`
      : revealing ? `暫時顯示全部 ${entries.size} 筆`
      : settings.level === 1 ? `已標示 ${matched} / ${entries.size} 筆` : `已${action} ${hidden} / ${entries.size} 筆`;
    const issues = Array.from(entries.values()).filter(e => e.parseIssue).length;
    note.textContent = !main || entries.size > 1
      ? `背景確認 ${pending} 筆；${checked} 筆未找到披露；${unknown} 筆尚未確認。${failed ? ` ${failed} 筆查詢暫不可用。` : ""}未找到披露不代表沒有使用 AI。${issues ? ` ${issues} 筆標籤格式無法讀取。` : ""}`
      : "詳情頁保留供你查看。未取得訊號不代表沒有使用 AI。";
    reveal.hidden = hidden === 0 && !revealing;
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
      void send({type: "SAF_UPDATED", status}).catch(() => undefined);
    }
  }
  function scan() {
    timer = 0;
    if (!ready || !contextReady()) return;
    appMatch = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    kind = SAF.pageKind(location.pathname);
    {
      const cards = new Set(SAF.collectCards(document).filter(card => SAF.cardId(card) !== appMatch?.[1]));
      for (const element of entries.keys()) {
        if (element === document.documentElement) continue;
        if (!cards.has(element)) {
          SAF.syncMask(element, null); element.classList.remove("saf-badge-positioned");
          element.querySelector(".saf-badge")?.remove(); entries.delete(element);
          visibility.unobserve(element); nearby.delete(element);
        }
      }
      for (const card of cards) {
        if (entries.has(card) && !dirty.has(card)) continue;
        const id = SAF.cardId(card);
        if (!id || !/^\d+$/.test(id)) {
          SAF.syncMask(card, null); card.querySelector(".saf-badge")?.remove();
          entries.delete(card); continue; // bundles and packages aren't a single game
        }
        const title = SAF.cardTitle(card, id);
        entries.set(card, SAF.readEvidence(card, id, title));
        visibility.observe(card);
      }
    }
    entries.delete(document.documentElement);
    if (appMatch && document.querySelector("#appHubAppName, .apphub_AppName")) {
      entries.set(document.documentElement, SAF.readEvidence(document, appMatch![1],
        document.querySelector("#appHubAppName, .apphub_AppName")?.textContent?.trim() || `App ${appMatch![1]}`));
    }
    dirty.clear(); placeHost(); render();
  }
  function schedule() { if (contextReady() && !timer) timer = window.setTimeout(scan, 100); }
  window.addEventListener("popstate", schedule, {signal: events.signal});
  const observer = new MutationObserver(records => {
    if (!contextReady()) return;
    let relevant = false;
    for (const record of records) {
      const el = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!el || el.closest("#saf-root, .saf-badge, .saf-mask")) continue;
      if (record.type === "childList") {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.length && nodes.every(n => n instanceof Element && (n.id === "saf-root" || n.matches(".saf-badge, .saf-mask")))) continue;
      }
      relevant = true;
      for (let card: Element | null = el; card; card = card.parentElement) {
        if (entries.has(card)) { dirty.add(card); break; }
      }
    }
    if (relevant) schedule();
  });
  if (!contextReady()) return;
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !contextReady()) return;
      if (changes.level) { settings.level = SAF.normalizeLevel(changes.level.newValue); revealing = false; }
      if (changes.presentation) { settings.presentation = SAF.normalizePresentation(changes.presentation.newValue); revealing = false; }
      if (changes.allow) settings.allow = SAF.cleanAllow(changes.allow.newValue);
      if (changes.disclosureCache) readCache(changes.disclosureCache.newValue);
      if (ready && (changes.level || changes.presentation || changes.allow || changes.disclosureCache)) render();
    });
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (!contextReady()) return;
      if (!message || !["SAF_STATUS", "SAF_REFRESH", "SAF_REVEAL"].includes(message.type)) return;
      if (!ready) { respond(null); return; }
      if (message.type === "SAF_REFRESH") {
        SAF.getSettings().then(data => {
          if (!contextReady()) return;
          settings = data; render(); if (!stopped) respond(status);
        }).catch(e => { report(e); if (!stopped) respond(null); });
        return true;
      }
      if (message.type === "SAF_REVEAL") { revealing = !revealing; render(); }
      if (!stopped) respond(status);
    });
  } catch (e) { report(e); return; }
  void (async () => {
    try {
      const [data, cache] = await Promise.all([SAF.getSettings(), chrome.storage.local.get("disclosureCache")]);
      if (!contextReady()) return;
      settings = data; readCache(cache.disclosureCache); ready = true; scan();
      if (stopped) return;
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["data-ds-tagids", "data-ds-appid", "data-appid", "data-app-id", "data-ds-itemkey", "href", "alt", "src", "data-image-url"]
      });
    } catch (e) { placeHost(); report(e); }
  })();
})();
