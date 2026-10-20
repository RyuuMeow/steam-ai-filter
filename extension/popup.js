"use strict";
(() => {
    const input = document.querySelector("#strength");
    const control = document.querySelector(".filter-control");
    const rule = document.querySelector("#rule-text");
    const broadWarning = document.querySelector("#broad-warning");
    const presentationControl = document.querySelector("#presentation");
    const presentations = Array.from(document.querySelectorAll('input[name="presentation"]'));
    const filterOptions = document.querySelector("#filter-options");
    const categoryList = document.querySelector("#category-list");
    const categoryToggles = new Map();
    for (const category of SAFDisclosure.categories) {
        const label = document.createElement("label"), text = document.createElement("span"), toggle = document.createElement("input");
        label.className = "toggle-row";
        label.htmlFor = `filter-${category}`;
        text.textContent = SAFDisclosure.packs[category].label;
        toggle.id = `filter-${category}`;
        toggle.type = "checkbox";
        toggle.setAttribute("role", "switch");
        toggle.disabled = true;
        label.append(text, toggle);
        categoryList.append(label);
        categoryToggles.set(category, toggle);
    }
    const ignoreOption = document.querySelector("#ignore-option");
    const autoIgnore = document.querySelector("#auto-ignore");
    const checkedOption = document.querySelector("#checked-option");
    const showChecked = document.querySelector("#show-checked");
    const ignoreStatus = document.querySelector("#ignore-status");
    const pageStatus = document.querySelector("#page-status");
    const status = document.querySelector("#status");
    const coverage = document.querySelector("#coverage");
    const reveal = document.querySelector("#reveal");
    const error = document.querySelector("#error");
    let settings = { level: 2, presentation: "mask", filterCategories: SAF.normalizeCategories(), autoIgnore: false, showChecked: true, allow: {} };
    let ignoreState = {};
    let tabId;
    let isStoreTab = false;
    let writeQueue = Promise.resolve();
    function report(e) {
        console.error("Steam AI Filter:", e);
        error.hidden = false;
        error.textContent = "設定未能儲存，請重新開啟插件再試。";
    }
    function paint(level) {
        const changed = control.dataset.level !== String(level);
        control.dataset.level = String(level);
        control.style.setProperty("--fraction", String(level / 3));
        input.value = String(level);
        rule.textContent = SAF.levels[level].description.replace("遮蔽", settings.presentation === "remove" ? "剔除" : "遮蔽");
        broadWarning.hidden = level !== 3;
        presentationControl.hidden = level < 2;
        filterOptions.hidden = level < 2;
        for (const [category, toggle] of categoryToggles)
            toggle.checked = settings.filterCategories[category];
        const selected = SAFDisclosure.categories.filter(category => settings.filterCategories[category]);
        document.querySelector("#filter-selection").textContent = selected.length === 1
            ? SAFDisclosure.packs[selected[0]].label : selected.length ? `已選 ${selected.length} 項` : "未選取";
        ignoreOption.hidden = level < 2;
        checkedOption.hidden = level === 0;
        autoIgnore.checked = settings.autoIgnore;
        showChecked.checked = settings.showChecked;
        paintIgnore();
        for (const radio of presentations)
            radio.checked = radio.value === settings.presentation;
        input.setAttribute("aria-valuetext", SAF.levels[level].name);
        if (changed) {
            control.classList.remove("sweep");
            requestAnimationFrame(() => control.classList.add("sweep"));
        }
    }
    function paintIgnore() {
        ignoreStatus.hidden = !settings.autoIgnore;
        if (ignoreState.paused)
            ignoreStatus.textContent = ignoreState.paused;
        else if (settings.level < 2)
            ignoreStatus.textContent = "自動不感興趣已隨過濾暫停。";
        else if ((ignoreState.cooldownUntil || 0) > Date.now()) {
            ignoreStatus.textContent = `Steam 限流，${new Date(ignoreState.cooldownUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 後重試。`;
        }
        else {
            const pending = ignoreState.queue?.length || 0, done = Object.keys(ignoreState.done || {}).length;
            ignoreStatus.textContent = `待忽略 ${pending} 款 · 已確認忽略 ${done} 款${ignoreState.last ? `\n${ignoreState.last}` : ""}`;
        }
    }
    function renderAllow() {
        const entries = Object.entries(settings.allow);
        document.querySelector("#exceptions").hidden = entries.length === 0;
        document.querySelector("#allow-count").textContent = `(${entries.length})`;
        const list = document.querySelector("#allow-list");
        list.replaceChildren();
        for (const [id, title] of entries) {
            const li = document.createElement("li"), text = document.createElement("span");
            const button = document.createElement("button");
            text.textContent = title;
            button.textContent = "移除";
            button.className = "text-button";
            button.setAttribute("aria-label", `移除 ${title} 的永遠顯示設定`);
            button.onclick = async () => {
                button.disabled = true;
                try {
                    const latest = await SAF.getSettings();
                    delete latest.allow[id];
                    await chrome.storage.local.set({ allow: latest.allow });
                    settings.allow = latest.allow;
                    renderAllow();
                    await refresh();
                }
                catch (e) {
                    report(e);
                    button.disabled = false;
                }
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
        }
        catch {
            pageStatus.hidden = !isStoreTab || settings.level === 0;
            status.textContent = "重新整理 Steam 頁面以套用過濾。";
            reveal.hidden = true;
            coverage.hidden = true;
        }
    }
    function save(update) {
        writeQueue = writeQueue.then(async () => {
            const committed = typeof update === "function" ? await update() : update;
            await chrome.storage.local.set(committed);
            Object.assign(settings, committed);
            error.hidden = true;
            paint(settings.level);
            // Ask the page to reload settings so the count reflects the committed value.
            if (tabId !== undefined) {
                try {
                    await chrome.tabs.sendMessage(tabId, { type: "SAF_REFRESH" });
                }
                catch { /* refresh below displays unsupported/disconnected status */ }
            }
            await refresh();
        }).catch(e => { paint(settings.level); report(e); });
    }
    input.addEventListener("input", () => paint(SAF.normalizeLevel(Number(input.value))));
    input.addEventListener("change", () => save({ level: SAF.normalizeLevel(Number(input.value)) }));
    for (const radio of presentations)
        radio.addEventListener("change", () => {
            if (radio.checked)
                save({ presentation: SAF.normalizePresentation(radio.value) });
        });
    for (const [category, toggle] of categoryToggles)
        toggle.addEventListener("change", () => {
            const checked = toggle.checked;
            save(async () => {
                // Merge inside the serialized write queue so rapid changes retain every toggle.
                const latest = await SAF.getSettings();
                return { filterCategories: { ...latest.filterCategories, [category]: checked } };
            });
        });
    showChecked.addEventListener("change", () => save({ showChecked: showChecked.checked }));
    autoIgnore.addEventListener("change", () => {
        const enabled = autoIgnore.checked;
        autoIgnore.disabled = true;
        writeQueue = writeQueue.then(async () => {
            if (enabled) {
                const result = await chrome.runtime.sendMessage({ type: "SAF_IGNORE_ENABLE" });
                if (!result?.ok)
                    throw new Error(result?.issue || "無法開啟自動不感興趣。");
            }
            else
                await chrome.storage.local.set({ autoIgnore: false });
            settings.autoIgnore = enabled;
            await chrome.storage.local.set({ ignoreError: "" });
            error.hidden = true;
            paint(settings.level);
            if (tabId !== undefined) {
                try {
                    await chrome.tabs.sendMessage(tabId, { type: "SAF_REFRESH" });
                }
                catch { /* refresh reports disconnected pages */ }
            }
            await refresh();
        }).catch(e => {
            paint(settings.level);
            error.hidden = false;
            error.textContent = e instanceof Error ? e.message : "設定未能儲存，請再試一次。";
        }).finally(() => { autoIgnore.disabled = false; });
    });
    reveal.onclick = async () => {
        if (tabId === undefined)
            return;
        try {
            await chrome.tabs.sendMessage(tabId, { type: "SAF_REVEAL" });
            await refresh();
        }
        catch {
            pageStatus.hidden = false;
            status.textContent = "頁面連線已中斷，請重新整理。";
        }
    };
    document.querySelector("#clear-cache").onclick = async (event) => {
        const button = event.currentTarget;
        const resultText = document.querySelector("#cache-result");
        button.disabled = true;
        resultText.hidden = true;
        try {
            const result = await chrome.runtime.sendMessage({ type: "SAF_CLEAR_CACHE" });
            if (!result?.ok)
                throw new Error("Cache clear failed");
            resultText.textContent = "查詢快取已清除。";
            resultText.dataset.error = "false";
            await refresh();
        }
        catch {
            resultText.textContent = "清除失敗，請再試一次。";
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
        if (changes.level) {
            settings.level = SAF.normalizeLevel(changes.level.newValue);
            if (document.activeElement !== input)
                paint(settings.level);
            void refresh();
        }
        if (changes.allow) {
            settings.allow = SAF.cleanAllow(changes.allow.newValue);
            renderAllow();
        }
        if (changes.presentation) {
            settings.presentation = SAF.normalizePresentation(changes.presentation.newValue);
            paint(settings.level);
            void refresh();
        }
        if (changes.filterCategories) {
            settings.filterCategories = SAF.normalizeCategories(changes.filterCategories.newValue);
            paint(settings.level);
            void refresh();
        }
        if (changes.autoIgnore) {
            settings.autoIgnore = changes.autoIgnore.newValue === true;
            paint(settings.level);
        }
        if (changes.showChecked) {
            settings.showChecked = changes.showChecked.newValue !== false;
            paint(settings.level);
        }
        if (changes.ignoreState) {
            ignoreState = changes.ignoreState.newValue || {};
            paintIgnore();
        }
        if (typeof changes.ignoreError?.newValue === "string" && changes.ignoreError.newValue) {
            error.hidden = false;
            error.textContent = changes.ignoreError.newValue;
        }
    });
    input.disabled = true;
    for (const radio of presentations)
        radio.disabled = true;
    autoIgnore.disabled = true;
    showChecked.disabled = true;
    void (async () => {
        try {
            settings = await SAF.getSettings();
            const stored = await chrome.storage.local.get(["ignoreState", "ignoreError"]);
            ignoreState = stored.ignoreState || {};
            paint(settings.level);
            renderAllow();
            if (typeof stored.ignoreError === "string" && stored.ignoreError) {
                error.hidden = false;
                error.textContent = stored.ignoreError;
            }
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            isStoreTab = Boolean(tab?.url?.startsWith("https://store.steampowered.com/"));
            tabId = tab?.id;
            await refresh();
            input.disabled = false;
            for (const radio of presentations)
                radio.disabled = false;
            for (const toggle of categoryToggles.values())
                toggle.disabled = false;
            autoIgnore.disabled = false;
            showChecked.disabled = false;
        }
        catch (e) {
            report(e);
        }
    })();
})();
