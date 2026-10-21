"use strict";
(() => {
    const $ = (selector) => document.querySelector(selector);
    const t = SAFI18n.t;
    const input = $("#strength"), control = $(".filter-control");
    const autoIgnore = $("#auto-ignore"), showChecked = $("#show-checked");
    const error = $("#error"), connection = $("#connection"), ignoreStatus = $("#ignore-status");
    const language = $("#language");
    const hoverReveal = $("#hover-reveal");
    const categoryToggles = new Map();
    for (const category of SAF.filterCategories) {
        const label = document.createElement("label"), text = document.createElement("span"), toggle = document.createElement("input");
        label.className = "toggle-row";
        label.htmlFor = `filter-${category}`;
        text.dataset.i18n = `filter.${category}`;
        toggle.id = `filter-${category}`;
        toggle.type = "checkbox";
        toggle.setAttribute("role", "switch");
        toggle.disabled = true;
        if (category === "unknown")
            label.dataset.i18nTitle = "filter.unknownHelp";
        label.append(text, toggle);
        $("#category-list").append(label);
        categoryToggles.set(category, toggle);
    }
    const fields = { cacheDays: $("#cache-days"), requestGap: $("#request-gap"), concurrency: $("#concurrency") };
    const selects = Array.from(document.querySelectorAll("select"), SAFSelect.enhance);
    const titles = { home: "category.home", settings: "category.settings", checking: "category.checking", network: "category.network", display: "category.display", automation: "category.automation", language: "category.language" };
    const routes = [{ view: "home", scroll: 0 }];
    function navigate(view, trigger) {
        const current = routes[routes.length - 1];
        current.scroll = window.scrollY;
        const leaving = view ? undefined : routes.pop();
        if (view)
            routes.push({ view, scroll: 0, trigger });
        const next = routes[routes.length - 1];
        for (const section of document.querySelectorAll("main > section[data-view]"))
            section.hidden = section.dataset.view !== next.view;
        $("#back").hidden = next.view === "home";
        $("#settings").hidden = next.view !== "home";
        $("#page-title").textContent = t(titles[next.view]);
        document.documentElement.dataset.view = next.view;
        (leaving?.trigger || $("#page-title")).focus({ preventScroll: true });
        window.scrollTo(0, next.scroll);
    }
    for (const button of document.querySelectorAll("[data-open]"))
        button.onclick = () => navigate(button.dataset.open, button);
    $("#back").onclick = () => { if (routes.length > 1)
        navigate(); };
    let settings = SAF.normalizeSettings(), ignoreState = {};
    let tabId, isStoreTab = false, settingsRevision = 0;
    let writeQueue = Promise.resolve();
    let modeDraft = null, modeRevision = 0;
    function translate() {
        SAFI18n.setLanguage(settings.language);
        document.documentElement.lang = settings.language;
        for (const [attribute, target] of [["data-i18n", ""], ["data-i18n-aria", "aria-label"], ["data-i18n-title", "title"]]) {
            for (const element of document.querySelectorAll(`[${attribute}]`)) {
                const value = t(element.getAttribute(attribute));
                if (target)
                    element.setAttribute(target, value);
                else
                    element.textContent = value;
            }
        }
        $("#page-title").textContent = t(titles[routes[routes.length - 1].view]);
        for (const option of fields.cacheDays.options)
            if (option.value !== "0")
                option.textContent = t(option.value === "1" ? "option.day" : "option.days", { count: option.value });
        for (const option of fields.requestGap.options) {
            const value = t(option.value === "1000" ? "option.second" : "option.seconds", { count: Number(option.value) / 1000 });
            option.textContent = option.value === "700" ? t("option.default", { value }) : value;
        }
        fields.concurrency.options[1].textContent = t("option.default", { value: 2 });
        language.value = settings.language;
        if (!error.hidden)
            error.textContent = SAFI18n.localizeStored(error.textContent || "");
        if (!connection.hidden)
            connection.textContent = t("error.refresh");
        if (!$("#cache-result").hidden)
            $("#cache-result").textContent = t($("#cache-result").dataset.error === "true" ? "cache.clearFailed" : "cache.cleared");
    }
    function report(e) {
        console.error("Steam AI Filter:", e);
        error.hidden = false;
        error.textContent = t("error.save");
    }
    function paintPosition(position) {
        const index = Math.round(position);
        control.dataset.level = String(index);
        control.style.setProperty("--fraction", String(position / 3));
        input.value = String(position);
        input.setAttribute("aria-valuetext", t(`mode.${SAF.modes[index].id}`));
    }
    function paintMode(mode) {
        paintPosition(SAF.modes.findIndex(item => item.id === mode));
    }
    function paint() {
        translate();
        if (!control.classList.contains("dragging"))
            paintMode(modeDraft || settings.mode);
        for (const [category, toggle] of categoryToggles)
            toggle.checked = settings.filterCategories[category];
        autoIgnore.checked = settings.autoIgnore;
        showChecked.checked = settings.showChecked;
        hoverReveal.checked = settings.hoverReveal;
        for (const [key, field] of Object.entries(fields))
            field.value = String(settings[key]);
        selects.forEach(sync => sync());
        paintIgnore();
    }
    function paintIgnore() {
        ignoreStatus.hidden = !settings.autoIgnore;
        if (ignoreState.paused)
            ignoreStatus.textContent = SAFI18n.localizeStored(ignoreState.paused);
        else if (!SAF.filters(settings.mode))
            ignoreStatus.textContent = t("automation.disabledMode");
        else if ((ignoreState.cooldownUntil || 0) > Date.now())
            ignoreStatus.textContent = t("automation.cooldown", { time: new Date(ignoreState.cooldownUntil).toLocaleTimeString(settings.language, { hour: "2-digit", minute: "2-digit" }) });
        else {
            const pending = ignoreState.queue?.length || 0, done = Object.keys(ignoreState.done || {}).length;
            ignoreStatus.hidden = pending === 0 && done === 0 && !ignoreState.last;
            ignoreStatus.textContent = t("automation.queue", { pending, done, last: ignoreState.last ? `\n${SAFI18n.localizeStored(ignoreState.last)}` : "" });
        }
    }
    function renderAllow() {
        const entries = Object.entries(settings.allow);
        $("#exceptions").hidden = entries.length === 0;
        const list = $("#allow-list");
        list.replaceChildren();
        for (const [id, title] of entries) {
            const li = document.createElement("li"), text = document.createElement("span"), button = document.createElement("button");
            text.textContent = title;
            button.textContent = t("action.remove");
            button.className = "text-button";
            button.setAttribute("aria-label", t("action.removeAllow", { title }));
            button.onclick = () => {
                button.disabled = true;
                save(latest => { const allow = { ...latest.allow }; delete allow[id]; return { allow }; });
            };
            li.append(text, button);
            list.append(li);
        }
    }
    async function refresh() {
        if (tabId === undefined)
            return;
        try {
            const data = await chrome.tabs.sendMessage(tabId, { type: "SAF_STATUS" });
            if (!data || !["app", "home", "search", "store"].includes(data.kind))
                throw new Error("Unsupported page");
            connection.hidden = true;
        }
        catch {
            connection.hidden = !isStoreTab || settings.mode === "off";
            connection.textContent = t("error.refresh");
        }
    }
    async function refreshPage() {
        if (tabId !== undefined) {
            try {
                await chrome.tabs.sendMessage(tabId, { type: "SAF_REFRESH" });
            }
            catch { /* refresh displays disconnected-page feedback */ }
        }
        await refresh();
    }
    function save(update) {
        writeQueue = writeQueue.then(async () => {
            const stored = await chrome.storage.local.get(SAF.settingKeys);
            const latest = SAF.normalizeSettings(stored);
            const patch = typeof update === "function" ? update(latest) : update;
            // Atomically adopt the new schema on the first edit; legacy reads are pure and idempotent.
            const migration = stored.mode === undefined ? { mode: latest.mode } : {};
            await chrome.storage.local.set({ settingsVersion: 2, ...migration, ...patch });
            settings = await SAF.getSettings();
            error.hidden = true;
            paint();
            renderAllow();
            await refreshPage();
        }).catch(async (e) => {
            try {
                settings = await SAF.getSettings();
            }
            catch { /* retain the last committed snapshot */ }
            paint();
            renderAllow();
            report(e);
        });
    }
    function commitMode() {
        const mode = SAF.modes[Math.round(Number(input.value))].id, revision = ++modeRevision;
        modeDraft = mode;
        control.classList.remove("dragging");
        paintMode(mode);
        save({ mode });
        void writeQueue.finally(() => { if (revision === modeRevision) {
            modeDraft = null;
            paint();
        } });
    }
    input.addEventListener("pointerdown", () => control.classList.add("dragging"));
    input.addEventListener("input", () => paintPosition(Number(input.value)));
    input.addEventListener("change", commitMode);
    input.addEventListener("pointercancel", () => { control.classList.remove("dragging"); paint(); });
    // Native range emits change after pointerup. Do not overwrite its draft value here.
    window.addEventListener("pointerup", () => control.classList.remove("dragging"));
    input.addEventListener("keydown", event => {
        const index = Math.round(Number(input.value));
        const next = event.key === "Home" ? 0 : event.key === "End" ? 3
            : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(3, index + 1)
                : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(0, index - 1) : null;
        if (next === null)
            return;
        event.preventDefault();
        paintPosition(next);
        commitMode();
    });
    language.addEventListener("change", () => save({ language: SAFI18n.normalizeLanguage(language.value) }));
    for (const [category, toggle] of categoryToggles)
        toggle.addEventListener("change", () => {
            const checked = toggle.checked;
            save(latest => ({ filterCategories: { ...latest.filterCategories, [category]: checked } }));
        });
    for (const [key, field] of Object.entries(fields))
        field.addEventListener("change", () => save({ [key]: Number(field.value) }));
    showChecked.addEventListener("change", () => save({ showChecked: showChecked.checked }));
    hoverReveal.addEventListener("change", () => save({ hoverReveal: hoverReveal.checked }));
    autoIgnore.addEventListener("change", () => {
        const enabled = autoIgnore.checked;
        autoIgnore.disabled = true;
        writeQueue = writeQueue.then(async () => {
            if (enabled) {
                const result = await chrome.runtime.sendMessage({ type: "SAF_IGNORE_ENABLE" });
                if (!result?.ok)
                    throw new Error(result?.issue || t("automation.enableFailed"));
            }
            else
                await chrome.storage.local.set({ autoIgnore: false });
            settings = await SAF.getSettings();
            await chrome.storage.local.set({ ignoreError: "" });
            error.hidden = true;
            paint();
            await refreshPage();
        }).catch(async (e) => {
            try {
                settings = await SAF.getSettings();
            }
            catch { /* retain committed values */ }
            paint();
            error.hidden = false;
            error.textContent = e instanceof Error ? SAFI18n.localizeStored(e.message) : t("error.save");
        }).finally(() => { autoIgnore.disabled = false; });
    });
    $("#clear-cache").onclick = async (event) => {
        const button = event.currentTarget, resultText = $("#cache-result");
        button.disabled = true;
        resultText.hidden = true;
        try {
            const result = await chrome.runtime.sendMessage({ type: "SAF_CLEAR_CACHE" });
            if (!result?.ok)
                throw new Error("Cache clear failed");
            resultText.textContent = t("cache.cleared");
            resultText.dataset.error = "false";
            await refresh();
        }
        catch {
            resultText.textContent = t("cache.clearFailed");
            resultText.dataset.error = "true";
        }
        finally {
            button.disabled = false;
            resultText.hidden = false;
        }
    };
    chrome.runtime.onMessage.addListener((message, sender) => {
        if (message?.type === "SAF_UPDATED" && sender.tab?.id === tabId)
            void refresh();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local")
            return;
        if (SAF.settingKeys.some(key => changes[key])) {
            const revision = ++settingsRevision;
            void SAF.getSettings().then(next => {
                if (revision !== settingsRevision)
                    return;
                settings = next;
                paint();
                if (changes.allow || changes.language)
                    renderAllow();
                void refresh();
            }).catch(report);
        }
        if (changes.ignoreState) {
            ignoreState = changes.ignoreState.newValue || {};
            paintIgnore();
        }
        if (typeof changes.ignoreError?.newValue === "string" && changes.ignoreError.newValue) {
            error.hidden = false;
            error.textContent = SAFI18n.localizeStored(changes.ignoreError.newValue);
        }
    });
    void (async () => {
        try {
            settings = await SAF.getSettings();
            const stored = await chrome.storage.local.get(["ignoreState", "ignoreError"]);
            ignoreState = stored.ignoreState || {};
            paint();
            renderAllow();
            if (typeof stored.ignoreError === "string" && stored.ignoreError) {
                error.hidden = false;
                error.textContent = SAFI18n.localizeStored(stored.ignoreError);
            }
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            isStoreTab = Boolean(tab?.url?.startsWith("https://store.steampowered.com/"));
            tabId = tab?.id;
            await refresh();
            for (const element of document.querySelectorAll("input, select, #clear-cache"))
                element.disabled = false;
            selects.forEach(sync => sync());
        }
        catch (e) {
            report(e);
        }
    })();
})();
