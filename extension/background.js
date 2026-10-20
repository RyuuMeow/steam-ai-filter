"use strict";
importScripts("lookup.js", "disclosure-keywords.js", "disclosure.js", "core.js", "ignore.js");
(() => {
    const resolver = new SAFLookup.Resolver({
        load: async () => (await chrome.storage.local.get("disclosureCache")).disclosureCache,
        save: data => chrome.storage.local.set({ disclosureCache: data }),
        fetch: (url, init) => fetch(url, init)
    });
    const ignoreAlarm = "saf-auto-ignore";
    const ignore = new SAFIgnore.Service({
        load: async () => (await chrome.storage.local.get("ignoreState")).ignoreState,
        settings: () => SAF.getSettings(),
        cache: async () => (await chrome.storage.local.get("disclosureCache")).disclosureCache?.items || {},
        cooldown: async () => (await chrome.storage.local.get("disclosureCache")).disclosureCache?.cooldownUntil || 0,
        save: (ignoreState, enabled) => chrome.storage.local.set(enabled === undefined ? { ignoreState } : { ignoreState, autoIgnore: enabled }),
        fetch: (url, init) => fetch(url, init),
        schedule: async (when) => {
            if (when === null) {
                await chrome.alarms.clear(ignoreAlarm);
                return;
            }
            const existing = await chrome.alarms.get(ignoreAlarm);
            // Repeated card sightings must not keep postponing the same pending action.
            if (!existing || existing.scheduledTime > when)
                await chrome.alarms.create(ignoreAlarm, { when });
        }
    });
    const reportIgnoreFailure = () => {
        // A storage/runtime failure must fail closed, with an actionable UI message.
        void chrome.storage.local.set({ autoIgnore: false, ignoreError: "自動不感興趣已停止，請重新開啟插件再試。" })
            .catch(() => console.error("Steam AI Filter: auto-ignore storage unavailable"));
    };
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === ignoreAlarm)
            void ignore.tick().catch(reportIgnoreFailure);
    });
    void ignore.reconcile().catch(reportIgnoreFailure);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.level)
            resolver.setEnabled(changes.level.newValue !== 0);
        const ignoreCooldown = changes.ignoreState?.newValue?.cooldownUntil || 0;
        if (area === "local" && ignoreCooldown > Date.now())
            resolver.setEnabled(false);
        if (area === "local" && (changes.autoIgnore || changes.level || changes.allow || changes.acceptAICode)) {
            void ignore.reconcile().catch(reportIgnoreFailure);
        }
    });
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id)
            return;
        if (message?.type === "SAF_IGNORE_ENABLE" && sender.url === chrome.runtime.getURL("popup.html")) {
            ignore.enable().then(respond, () => respond({ ok: false, issue: "設定未能儲存，請再試一次。" }));
            return true;
        }
        if (message?.type === "SAF_CLEAR_CACHE" && sender.url === chrome.runtime.getURL("popup.html")) {
            resolver.clear().then(() => respond({ ok: true }), () => respond({ ok: false }));
            return true;
        }
        let url;
        try {
            url = new URL(sender.url || "");
        }
        catch {
            return;
        }
        if (url.origin !== "https://store.steampowered.com")
            return;
        if (message?.type === "SAF_IGNORE_CANDIDATES") {
            ignore.enqueue(message.items).then(() => respond({ ok: true }), () => { reportIgnoreFailure(); respond({ ok: false }); });
            return true;
        }
        if (message?.type !== "SAF_LOOKUP" || !SAFLookup.validId(message.id))
            return;
        void chrome.storage.local.get(["level", "allow", "ignoreState"]).then(async (settings) => {
            const until = settings.ignoreState?.cooldownUntil || 0;
            if (until > Date.now()) {
                resolver.setEnabled(false);
                return SAFLookup.unavailable(Date.now(), "Steam 要求稍後重試", until - Date.now());
            }
            const enabled = settings.level !== 0;
            resolver.setEnabled(enabled);
            if (Object.hasOwn(settings.allow || {}, message.id))
                return SAFLookup.unavailable(Date.now(), "已設為永遠顯示", 0);
            return resolver.get(message.id);
        }).then(respond, () => respond(SAFLookup.unavailable(Date.now(), "查詢服務無法使用")));
        return true;
    });
})();
