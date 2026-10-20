declare function importScripts(...urls: string[]): void;
importScripts("lookup.js");
(() => {
  const resolver = new SAFLookup.Resolver({
    load: async () => (await chrome.storage.local.get("disclosureCache")).disclosureCache,
    save: data => chrome.storage.local.set({disclosureCache: data}),
    fetch: (url, init) => fetch(url, init)
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.level) resolver.setEnabled(changes.level.newValue !== 0);
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === "SAF_CLEAR_CACHE" && sender.url === chrome.runtime.getURL("popup.html")) {
      resolver.clear().then(() => respond({ok: true}), () => respond({ok: false}));
      return true;
    }
    if (message?.type !== "SAF_LOOKUP" || !SAFLookup.validId(message.id)) return;
    let url: URL;
    try { url = new URL(sender.url || ""); } catch { return; }
    if (url.origin !== "https://store.steampowered.com") return;
    void chrome.storage.local.get(["level", "allow"]).then(async settings => {
      const enabled = settings.level !== 0;
      resolver.setEnabled(enabled);
      if (Object.hasOwn(settings.allow || {}, message.id)) return SAFLookup.unavailable(Date.now(), "已設為永遠顯示", 0);
      return resolver.get(message.id);
    }).then(respond, () => respond(SAFLookup.unavailable(Date.now(), "查詢服務無法使用")));
    return true;
  });
})();
