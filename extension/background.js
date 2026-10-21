"use strict";
importScripts("i18n.js", "lookup.js", "disclosure-keywords.js", "disclosure.js", "core.js", "ignore.js");
(() => {
    const resolver = new SAFLookup.Resolver({
        load: async () => (await chrome.storage.local.get("disclosureCache")).disclosureCache,
        save: data => chrome.storage.local.set({ disclosureCache: data }),
        fetch: (url, init) => fetch(url, init)
    });
    // Fail closed until persisted mode and query policy have been read.
    resolver.setEnabled(false);
    let policyRevision = 0;
    let policyUpdate;
    function updatePolicy() {
        const revision = ++policyRevision;
        policyUpdate = Promise.all([SAF.getSettings(), chrome.storage.local.get("ignoreState")]).then(([settings, stored]) => {
            // A delayed storage read must never re-enable work after a newer off setting.
            if (revision !== policyRevision)
                return policyUpdate;
            SAFI18n.setLanguage(settings.language);
            const until = stored.ignoreState?.cooldownUntil || 0;
            resolver.setEnabled(settings.mode !== "off" && until <= Date.now());
            resolver.configure(settings);
            return { settings, until };
        });
        return policyUpdate;
    }
    void updatePolicy().catch(() => resolver.setEnabled(false));
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
        void chrome.storage.local.set({ autoIgnore: false, ignoreError: SAFI18n.t("automation.stopped") })
            .catch(() => console.error("Steam AI Filter: auto-ignore storage unavailable"));
    };
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === ignoreAlarm)
            void ignore.tick().catch(reportIgnoreFailure);
    });
    void ignore.reconcile().catch(reportIgnoreFailure);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local")
            return;
        if (changes.mode?.newValue === "off" || changes.level?.newValue === 0)
            resolver.setEnabled(false);
        const ignoreCooldown = changes.ignoreState?.newValue?.cooldownUntil || 0;
        if (ignoreCooldown > Date.now())
            resolver.setEnabled(false);
        if (SAF.settingKeys.some(key => changes[key]) || changes.ignoreState) {
            void updatePolicy().catch(() => resolver.setEnabled(false));
        }
        if (changes.autoIgnore || changes.mode || changes.level || changes.presentation || changes.allow || changes.filterCategories || changes.cacheDays) {
            void ignore.reconcile().catch(reportIgnoreFailure);
        }
    });
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (sender.id !== chrome.runtime.id)
            return;
        if (message?.type === "SAF_IGNORE_ENABLE" && sender.url === chrome.runtime.getURL("popup.html")) {
            ignore.enable().then(respond, () => respond({ ok: false, issue: SAFI18n.t("error.save") }));
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
        if (message?.type === "SAF_IGNORE_ONE") {
            ignore.ignoreOne(message.item).then(respond, () => respond({ ok: false, issue: SAFI18n.t("mask.actionFailed") }));
            return true;
        }
        if (message?.type === "SAF_IGNORE_CANDIDATES") {
            ignore.enqueue(message.items).then(() => respond({ ok: true }), () => { reportIgnoreFailure(); respond({ ok: false }); });
            return true;
        }
        if (message?.type !== "SAF_LOOKUP" || !SAFLookup.validId(message.id))
            return;
        void updatePolicy().then(async ({ settings, until }) => {
            if (until > Date.now()) {
                resolver.setEnabled(false);
                return SAFLookup.unavailable(Date.now(), SAFI18n.t("lookup.retryLater"), until - Date.now());
            }
            if (Object.hasOwn(settings.allow || {}, message.id))
                return SAFLookup.unavailable(Date.now(), SAFI18n.t("lookup.allowed"), 0);
            return resolver.get(message.id);
        }).then(respond, () => respond(SAFLookup.unavailable(Date.now(), SAFI18n.t("lookup.unavailable"))));
        return true;
    });
})();
