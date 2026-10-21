(() => {
  const t = SAFI18n.t;
  let appMatch = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
  let kind = SAF.pageKind(location.pathname);
  if (document.getElementById("saf-root")) return;
  let settings = SAF.normalizeSettings();
  const revealed = new Set<Element>(), hovered = new Set<Element>(), hoverSuppressed = new Set<Element>();
  const actionState = new Map<string, {pending?: "allow" | "ignore"; ignored?: boolean; issue?: string}>();
  let ready = false;
  let stopped = false;
  const events = new AbortController();
  let timer = 0;
  let currentDialog: SAF.Evidence | null = null;
  let previousStatus = "";
  let ignoreSignature = "";
  let ignoreSentAt = 0;
  let status: SAF.Status = {kind, total: 0, hidden: 0, matched: 0, unknown: 0, presentation: SAF.presentation(settings.mode)};
  const entries = new Map<Element, SAF.Evidence>();
  let effective = new Map<Element, SAF.Evidence>();
  const watched = new WeakSet<Element>();
  const rendered = new WeakMap<Element, string>();
  const dirty = new Set<Element>();
  const removalLayout = new SAF.RemovalLayout();
  const nearby = new Set<Element>();
  let remote = new Map<string, SAFLookup.Result>();
  const requesting = new Map<string, number>();
  let queryGeneration = 0;
  let settingsRevision = 0;
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
      ([id, result]) => SAFLookup.validId(id) && SAFLookup.validResult(result, Date.now()) && (result.state !== "unavailable" || cache?.sessionAware)));
  }
  function resultFor(id: string): SAFLookup.Result | undefined {
    const result = remote.get(id);
    return SAFLookup.fresh(result, Date.now(), settings.cacheDays) ? result : undefined;
  }
  function requestNearby() {
    window.clearTimeout(retryTimer);
    if (!ready || !contextReady() || settings.mode === "off" || document.hidden) return;
    const visibleEntries = [...nearby].filter(e => {
      const evidence = effective.get(e) || entries.get(e);
      return e.isConnected && evidence && !evidence.disclosure && !Object.hasOwn(settings.allow, evidence.id) &&
        !resultFor(evidence.id) && !requesting.has(evidence.id);
    });
    // Nearest cards are serviced first, independent of DOM/carousel order.
    visibleEntries.sort((a, b) => Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top));
    for (const element of visibleEntries) {
      const evidence = effective.get(element) || entries.get(element)!;
      if (requesting.size >= settings.concurrency) break;
      if (evidence.disclosure || Object.hasOwn(settings.allow, evidence.id) ||
          resultFor(evidence.id) || requesting.has(evidence.id)) continue;
      const id = evidence.id;
      const generation = queryGeneration;
      requesting.set(id, generation);
      void send({type: "SAF_LOOKUP", id}).then((result: unknown) => {
        if (!contextReady() || generation !== queryGeneration || settings.mode === "off") return;
        const reply = result as SAFLookup.Result | undefined;
        if (reply?.state === "unavailable" && reply.expiresAt <= reply.checkedAt) remote.delete(id);
        else remote.set(id, SAFLookup.validResult(result, Date.now()) ? result : SAFLookup.unavailable(Date.now(), t("lookup.incomplete"), 30000));
      }).catch(() => {
        if (!contextReady() || generation !== queryGeneration || settings.mode === "off") return;
        remote.set(id, SAFLookup.unavailable(Date.now(), t("lookup.unavailable"), 60000));
      }).finally(() => { if (requesting.get(id) === generation) requesting.delete(id); if (contextReady()) render(); });
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
      :host{display:block;clear:both;margin:0;font:14px/1.5 "Segoe UI","Microsoft JhengHei",sans-serif;color:#d6e4f1}
      *{box-sizing:border-box} [hidden]{display:none!important}
      .bar{margin:12px 0;padding:12px 16px;background:#1c2d3c;border:1px solid #3a5368;border-radius:8px}
      .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .row strong{font-weight:600}
      button{font:inherit;color:#a6ddff;cursor:pointer;background:transparent;border:0;padding:4px 0;text-align:left}
      button:hover{text-decoration:underline} button:focus-visible,summary:focus-visible{outline:2px solid #80d7ff;outline-offset:3px}
      summary{cursor:pointer;margin-top:8px} ul{list-style:none;margin:8px 0 0;padding:0;max-height:240px;overflow:auto}
      li{border-top:1px solid #3a5368;padding:6px 0} .error{color:#ffbcbc}
      dialog{width:min(480px,calc(100vw - 32px));max-height:80vh;overflow:auto;border:0;border-radius:16px;padding:24px;background:#fff;color:#222435;box-shadow:0 10px 35px #0005}
      dialog::backdrop{background:#101a25aa} dialog h2{font-size:18px;margin:0 0 12px} dialog p{white-space:pre-wrap;overflow-wrap:anywhere}
      dialog button{color:#0053ea} .actions{display:flex;justify-content:space-between;gap:16px;margin-top:24px}
    </style>
    <section class="bar" hidden>
      <div class="row"><span id="stat"></span></div>
      <details id="matches" hidden><summary></summary><ul id="list"></ul></details>
      <p class="error" id="error" role="alert" hidden></p>
    </section>
    <dialog aria-labelledby="dialog-title">
      <h2 id="dialog-title"></h2><strong id="reason"></strong><p id="evidence"></p>
      <div class="actions"><button id="allow"></button><button id="close"></button></div>
    </dialog>`;
  const bar = shadow.querySelector<HTMLElement>(".bar")!;
  const stat = shadow.querySelector<HTMLElement>("#stat")!;
  const list = shadow.querySelector<HTMLElement>("#list")!;
  const dialog = shadow.querySelector<HTMLDialogElement>("dialog")!;
  const allowButton = shadow.querySelector<HTMLButtonElement>("#allow")!;
  function stop() {
    if (stopped) return;
    stopped = true; ready = false;
    window.clearTimeout(timer); timer = 0;
    window.clearTimeout(retryTimer); retryTimer = 0;
    observer.disconnect(); visibility.disconnect(); events.abort();
    removalLayout.clear();
    if (dialog.open) dialog.close();
    for (const element of entries.keys()) {
      if (element === document.documentElement) continue;
      SAF.syncMask(element, null);
      element.classList.remove("saf-badge-positioned");
      element.querySelector(".saf-badge")?.remove();
      element.querySelector(".saf-checked")?.remove();
      element.querySelector(".saf-remask")?.remove();
    }
    entries.clear(); effective.clear(); nearby.clear(); dirty.clear(); remote.clear(); requesting.clear();
    // Keep one recovery notice, with no dead buttons or obsolete counts.
    if (!host.isConnected) document.body.prepend(host);
    host.style.display = ""; bar.hidden = false;
    stat.textContent = t("error.stopped"); stat.hidden = false;
    allowButton.disabled = true;
    list.replaceChildren();
    shadow.querySelector<HTMLElement>("#matches")!.hidden = true;
    shadow.querySelector<HTMLElement>("#error")!.hidden = true;
  }
  function report(e: unknown) {
    if (isInvalidated(e) || !contextReady()) { stop(); return; }
    console.error("Steam AI Filter:", e);
    bar.hidden = false;
    const error = shadow.querySelector<HTMLElement>("#error")!;
    error.hidden = false; error.textContent = t("error.contentSettings");
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
    shadow.querySelector("#reason")!.textContent = displayReason(e);
    shadow.querySelector("#evidence")!.textContent = e.disclosure
      ? t("disclosure.original", {disclosure: e.disclosure, tagNote: e.tagMatch ? t("disclosure.tagNote") : ""})
      : t("disclosure.tagOnly");
    allowButton.textContent = t(Object.hasOwn(settings.allow, e.id) ? "action.disallow" : "action.allow");
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
  function displayReason(e: SAF.Evidence): string {
    if (!e.disclosure) return SAF.reason(e);
    const uses = SAFDisclosure.classifyUses(e.disclosure);
    if (!uses.length) return t("reason.unknown");
    const selected = uses.some(category => settings.filterCategories[category]);
    return t("reason.uses", {uses: uses.map(SAF.categoryLabel).join(t("list.separator")), unselected: selected ? "" : t("reason.unselected")});
  }
  function revealCard(card: Element) {
    revealed.add(card); hovered.delete(card); render();
    if (card instanceof HTMLElement) card.focus({preventScroll: true});
  }
  function restoreCard(card: Element) {
    revealed.delete(card); hovered.delete(card); hoverSuppressed.add(card); render();
    if (card instanceof HTMLElement) card.focus({preventScroll: true});
  }
  async function allowCard(evidence: SAF.Evidence) {
    actionState.set(evidence.id, {pending: "allow"}); render();
    try {
      const latest = await SAF.getSettings();
      await chrome.storage.local.set({allow: {...latest.allow, [evidence.id]: evidence.title}});
      actionState.delete(evidence.id);
    } catch { actionState.set(evidence.id, {issue: t("mask.actionFailed")}); }
    if (contextReady()) render();
  }
  async function ignoreCard(evidence: SAF.Evidence) {
    actionState.set(evidence.id, {pending: "ignore"}); render();
    try {
      const result = await send({type: "SAF_IGNORE_ONE", item: evidence}) as {ok?: boolean; issue?: string} | undefined;
      actionState.set(evidence.id, result?.ok ? {ignored: true} : {issue: result?.issue || t("mask.actionFailed")});
    } catch { actionState.set(evidence.id, {issue: t("mask.actionFailed")}); }
    if (contextReady()) render();
  }
  function maskActions(card: Element, evidence: SAF.Evidence): SAF.MaskActions {
    return {...actionState.get(evidence.id), reveal: () => revealCard(card),
      allow: () => { void allowCard(evidence); }, ignore: () => { void ignoreCard(evidence); }};
  }
  function icon(name: string): HTMLImageElement {
    const image = document.createElement("img"); image.alt = "";
    image.src = chrome.runtime.getURL(`icons/${name}.svg`); return image;
  }
  function watchCard(card: Element) {
    if (watched.has(card)) return;
    watched.add(card);
    const activate = (event: Event) => {
      if (!card.classList.contains("saf-blocked") && !hovered.has(card)) return;
      if ((event.target as Element)?.closest?.(".saf-mask button, .saf-remask")) return;
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      revealCard(card);
    };
    card.addEventListener("click", activate, {capture: true, signal: events.signal});
    card.addEventListener("auxclick", event => {
      if (card.classList.contains("saf-blocked")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, {capture: true, signal: events.signal});
    card.addEventListener("keydown", activate, {capture: true, signal: events.signal});
    card.addEventListener("pointerenter", () => {
      if (settings.mode === "mask" && settings.hoverReveal && !hoverSuppressed.has(card) && card.classList.contains("saf-blocked")) {
        hovered.add(card); render();
      }
    }, {signal: events.signal});
    card.addEventListener("pointerleave", () => {
      hoverSuppressed.delete(card);
      if (hovered.delete(card)) render();
    }, {signal: events.signal});
  }
  // Stop Steam hover previews for covered cards, including inline hover handlers.
  for (const type of ["mouseover", "mouseenter", "pointerover", "focusin"]) {
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
    const removed: Element[] = [];
    const ignoreItems = new Map<string, SAF.Evidence>();
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
      const match = SAF.matchesUses(evidence, settings.allow, settings.filterCategories);
      const result = isCard ? resultFor(evidence.id) : undefined;
      if (match) { matched++; candidates.set(evidence.id, evidence); }
      else if (result?.state === "not-found") checked++;
      else if (!evidence.disclosure) unknown++;
      if (requesting.has(evidence.id)) pending++;
      if (result?.state === "unavailable") failed++;
      const locallyShown = settings.mode === "mask" && (revealed.has(element) || hovered.has(element));
      const hide = isCard && !locallyShown && SAF.shouldHide(evidence, settings.mode, settings.allow, settings.filterCategories);
      // Include newly accepted evidence too, so a queued older match can be cancelled.
      if (settings.autoIgnore) ignoreItems.set(evidence.id, evidence);
      if (hide) hidden++;
      if (hide && settings.mode === "hide") removed.push(element);
      if (isCard) {
        const state = JSON.stringify([settings.mode, settings.language, settings.showChecked, evidence.id, evidence.title,
          evidence.disclosure, result?.state, match, hide, locallyShown, actionState.get(evidence.id)]);
        if (rendered.get(element) === state) continue;
        watchCard(element);
        if (!hide || settings.mode !== "mask") SAF.syncMask(element, hide ? evidence : null, SAF.presentation(settings.mode));
        const existing = element.querySelector<HTMLElement>(".saf-badge");
        const showBadge = settings.mode === "mark" && match;
        if (!showBadge) existing?.remove();
        else {
          const badge = existing || document.createElement("span");
          const uses = SAFDisclosure.classifyUses(evidence.disclosure);
          const labels: SAF.FilterCategory[] = uses.length ? [...uses] : ["unknown"];
          const signature = settings.language + labels.join(",");
          if (badge.dataset.uses !== signature) {
            const ai = document.createElement("span"); ai.className = "saf-chip saf-chip-ai"; ai.append(icon("ai"), "AI");
            badge.replaceChildren(ai);
            for (const category of labels) {
              const chip = document.createElement("span"); chip.className = `saf-chip saf-chip-${category}`;
              chip.append(icon(category), SAF.categoryLabel(category)); badge.append(chip);
            }
            badge.dataset.uses = signature;
          }
          badge.setAttribute("aria-label", t("disclosure.badgeAria", {uses: labels.map(SAF.categoryLabel).join(t("list.separator"))}));
          badge.title = t("disclosure.view");
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
        const checked = element.querySelector<HTMLElement>(".saf-checked");
        const hasResult = Boolean(evidence.disclosure) || result?.state === "not-found";
        const showCheck = settings.mode !== "off" && settings.showChecked && hasResult && !hide && !(locallyShown && match);
        if (!showCheck) checked?.remove();
        else if (!checked) {
          const check = document.createElement("span");
          check.className = "saf-checked";
          check.append(icon("check"));
          check.setAttribute("role", "img");
          if (getComputedStyle(element).position === "static") element.classList.add("saf-badge-positioned");
          element.append(check);
        }
        const check = element.querySelector<HTMLElement>(".saf-checked");
        if (check) {
          check.classList.toggle("saf-checked-matched", match);
          check.setAttribute("aria-label", t(match ? "checked.matched" : "checked.checked"));
          check.title = t(match ? "checked.matchedTitle" : "checked.unmatchedTitle");
        }
        let restore = element.querySelector<HTMLButtonElement>(".saf-remask");
        if (!locallyShown || !match) restore?.remove();
        else {
          if (!restore) {
            restore = document.createElement("button"); restore.type = "button"; restore.className = "saf-remask";
            restore.append(icon("eye"));
            restore.onclick = event => { event.preventDefault(); event.stopPropagation(); restoreCard(element); };
            element.append(restore);
          }
          restore.title = t("mask.restore"); restore.setAttribute("aria-label", t("mask.restore"));
          if (getComputedStyle(element).position === "static") element.classList.add("saf-badge-positioned");
        }
        // Include any newly inserted badge in the mask's accessibility suppression.
        if (hide && settings.mode === "mask") SAF.syncMask(element, evidence, "mask", maskActions(element, evidence));
        if (!showBadge && !showCheck && !(locallyShown && match)) element.classList.remove("saf-badge-positioned");
        rendered.set(element, state);
      }
    }
    if (settings.autoIgnore && SAF.filters(settings.mode) && !document.hidden) {
      const items = [...ignoreItems.values()].slice(0, 1000);
      const signature = JSON.stringify({items, mode: settings.mode, filterCategories: settings.filterCategories, allow: settings.allow});
      if (signature !== ignoreSignature || Date.now() - ignoreSentAt >= 30000) {
        ignoreSignature = signature; ignoreSentAt = Date.now();
        void send({type: "SAF_IGNORE_CANDIDATES", items}).then(result => {
          if (!(result as {ok?: boolean})?.ok) ignoreSignature = "";
        }).catch(() => { ignoreSignature = ""; });
      }
    } else ignoreSignature = "";
    removalLayout.sync(removed);
    const main = entries.get(document.documentElement);
    const mainMatched = Boolean(main && SAF.matchesUses(main, settings.allow, settings.filterCategories));
    status = {kind, total: entries.size, hidden, matched, unknown, pending, checked, failed, mainMatched, presentation: SAF.presentation(settings.mode)};
    const showMatches = settings.mode === "hide" && candidates.size > 0;
    bar.hidden = settings.mode === "off" || (!mainMatched && !showMatches);
    host.style.display = settings.mode === "off" ? "none" : "";
    if (settings.mode === "off" && dialog.open) dialog.close();
    shadow.querySelector("#close")!.textContent = t("action.close");
    shadow.querySelector("#matches summary")!.textContent = t("matches.title");
    stat.hidden = !mainMatched; stat.textContent = mainMatched ? t("status.mainMatched") : "";
    shadow.querySelector<HTMLElement>("#matches")!.hidden = !showMatches && !mainMatched;
    // Shadow-root updates do not feed the page observer.
    list.replaceChildren();
    for (const e of (showMatches || mainMatched) ? candidates.values() : []) {
      const li = document.createElement("li"), button = document.createElement("button");
      button.textContent = `${e.title} · ${displayReason(e)}${Object.hasOwn(settings.allow, e.id) ? t("allow.suffix") : ""}`;
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
    if (!ready || !contextReady() || settings.mode === "off") return;
    appMatch = location.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    kind = SAF.pageKind(location.pathname);
    {
      const cards = new Set(SAF.collectCards(document).filter(card => SAF.cardId(card) !== appMatch?.[1]));
      for (const element of entries.keys()) {
        if (element === document.documentElement) continue;
        if (!cards.has(element)) {
          SAF.syncMask(element, null); element.classList.remove("saf-badge-positioned");
          element.querySelector(".saf-badge")?.remove(); entries.delete(element);
          element.querySelector(".saf-checked")?.remove();
          element.querySelector(".saf-remask")?.remove(); revealed.delete(element); hovered.delete(element); hoverSuppressed.delete(element);
          rendered.delete(element);
          visibility.unobserve(element); nearby.delete(element);
        }
      }
      for (const card of cards) {
        if (entries.has(card) && !dirty.has(card)) continue;
        rendered.delete(card);
        const id = SAF.cardId(card);
        if (!id || !/^\d+$/.test(id)) {
          SAF.syncMask(card, null); card.querySelector(".saf-badge")?.remove();
          card.querySelector(".saf-checked")?.remove();
          entries.delete(card); continue; // bundles and packages aren't a single game
        }
        const title = SAF.cardTitle(card, id);
        if (entries.get(card)?.id !== id) { revealed.delete(card); hovered.delete(card); hoverSuppressed.delete(card); }
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
    if (!contextReady() || settings.mode === "off") return;
    let relevant = false;
    for (const record of records) {
      const el = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!el || el.closest("#saf-root, .saf-badge, .saf-checked, .saf-mask, .saf-remask")) continue;
      if (record.type === "childList") {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.length && nodes.every(n => n instanceof Element && (n.id === "saf-root" || n.matches(".saf-badge, .saf-checked, .saf-mask, .saf-remask")))) continue;
      }
      relevant = true;
      for (let card: Element | null = el; card; card = card.parentElement) {
        if (entries.has(card)) { dirty.add(card); break; }
      }
    }
    if (relevant) schedule();
  });
  if (!contextReady()) return;
  function applySettings(next: SAF.Settings) {
    const wasOff = settings.mode === "off";
    if (settings.mode !== next.mode || JSON.stringify(settings.filterCategories) !== JSON.stringify(next.filterCategories)) {
      revealed.clear(); hovered.clear(); hoverSuppressed.clear();
    }
    if (!next.hoverReveal) hovered.clear();
    if (next.mode === "off" && !wasOff) { queryGeneration++; requesting.clear(); }
    settings = next;
    SAFI18n.setLanguage(settings.language); host.lang = settings.language;
    ignoreSignature = "";
    if (wasOff && next.mode !== "off") {
      for (const element of entries.keys()) dirty.add(element);
      scan();
    } else render();
    if (dialog.open && currentDialog) openReason(currentDialog);
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !contextReady()) return;
      if (changes.disclosureCache) readCache(changes.disclosureCache.newValue);
      if (SAF.settingKeys.some(key => changes[key])) {
        const revision = ++settingsRevision;
        void SAF.getSettings().then(next => {
          if (contextReady() && ready && revision === settingsRevision) applySettings(next);
        }).catch(report);
      } else if (ready && changes.disclosureCache) {
        render();
      }
    });
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (!contextReady()) return;
      if (!message || !["SAF_STATUS", "SAF_REFRESH"].includes(message.type)) return;
      if (!ready) { respond(null); return; }
      if (message.type === "SAF_REFRESH") {
        SAF.getSettings().then(data => {
          if (!contextReady()) return;
          applySettings(data); if (!stopped) respond(status);
        }).catch(e => { report(e); if (!stopped) respond(null); });
        return true;
      }
      if (!stopped) respond(status);
    });
  } catch (e) { report(e); return; }
  void (async () => {
    try {
      const [data, cache] = await Promise.all([SAF.getSettings(), chrome.storage.local.get("disclosureCache")]);
      if (!contextReady()) return;
      settings = data; SAFI18n.setLanguage(settings.language); host.lang = settings.language;
      readCache(cache.disclosureCache); ready = true; scan();
      if (stopped) return;
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["data-ds-tagids", "data-ds-appid", "data-appid", "data-app-id", "data-ds-itemkey", "href", "alt", "src", "data-image-url"]
      });
    } catch (e) { placeHost(); report(e); }
  })();
})();
