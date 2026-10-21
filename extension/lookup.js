"use strict";
var SAFLookup;
(function (SAFLookup) {
    SAFLookup.validId = (id) => typeof id === "string" && /^[1-9]\d{0,9}$/.test(id);
    const DAY = 86400000;
    function unavailable(now, issue, retry = 300000) {
        return { state: "unavailable", disclosure: null, checkedAt: now, expiresAt: now + retry, issue };
    }
    SAFLookup.unavailable = unavailable;
    function validResult(value, now) {
        if (!value || typeof value !== "object")
            return false;
        const r = value;
        return ["disclosed", "not-found", "unavailable"].includes(r.state) &&
            Number.isFinite(r.checkedAt) && r.checkedAt <= now && Number.isFinite(r.expiresAt) &&
            r.expiresAt > r.checkedAt && r.expiresAt <= r.checkedAt + 30 * DAY &&
            (r.state === "disclosed" ? typeof r.disclosure === "string" && r.disclosure.length > 0 && r.disclosure.length <= 2000 : r.disclosure === null);
    }
    SAFLookup.validResult = validResult;
    function expiresAt(result, days) {
        if (days === undefined || result.state === "unavailable")
            return result.expiresAt;
        return result.checkedAt + (days || (result.state === "disclosed" ? 7 : 1)) * DAY;
    }
    SAFLookup.expiresAt = expiresAt;
    function fresh(value, now, days) {
        return validResult(value, now) && expiresAt(value, days) > now;
    }
    SAFLookup.fresh = fresh;
    function plain(html) {
        const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
        return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
            .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, key) => {
            if (!key.startsWith("#"))
                return entities[key.toLowerCase()] || raw;
            const point = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
            return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "\uFFFD";
        }).replace(/[ \t]+/g, " ").trim();
    }
    // Parse only the server-rendered descriptor section. No remote HTML is ever executed.
    function parse(html, id, now) {
        if (!SAFLookup.validId(id) || html.length > 4000000)
            return unavailable(now, SAFI18n.t("lookup.pageFormat"));
        const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
        const metas = clean.match(/<meta\b[^>]*>/gi) || [];
        const identity = metas.some(meta => /\bproperty\s*=\s*["']og:url["']/i.test(meta) &&
            new RegExp(`\\bcontent\\s*=\\s*["']https://store\\.steampowered\\.com/app/${id}(?:/|[?"'])`, "i").test(meta));
        const complete = identity && /\bid\s*=\s*["']appHubAppName["']/i.test(clean) &&
            /\bid\s*=\s*["']game_area_description["']/i.test(clean) &&
            /<\/body\s*>\s*<\/html\s*>/i.test(clean);
        if (!complete)
            return unavailable(now, SAFI18n.t("lookup.pageIncomplete"));
        const sections = clean.matchAll(/<div\b[^>]*\bid\s*=\s*["']game_area_content_descriptors["'][^>]*>([\s\S]*?)<\/div\s*>/gi);
        for (const section of sections) {
            const heading = section[1].match(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i);
            if (!heading || !/^ai[- ]generated content disclosure$/i.test(plain(heading[1]).replace(/\s+/g, " ")))
                continue;
            const quote = section[1].match(/<i\b[^>]*>([\s\S]*?)<\/i\s*>/i);
            // A heading with a changed/missing body is unknown, never a negative result.
            const disclosure = quote ? plain(quote[1]).slice(0, 2000) : "";
            if (!disclosure)
                return unavailable(now, SAFI18n.t("lookup.disclosureUnreadable"));
            return { state: "disclosed", disclosure, checkedAt: now, expiresAt: now + 7 * DAY };
        }
        // A familiar heading outside the expected structure means the adapter needs updating.
        if (/AI[- ]Generated Content Disclosure/i.test(clean))
            return unavailable(now, SAFI18n.t("lookup.disclosureChanged"));
        return { state: "not-found", disclosure: null, checkedAt: now, expiresAt: now + DAY };
    }
    SAFLookup.parse = parse;
    class Resolver {
        options;
        items = {};
        cooldownUntil = 0;
        pending = new Map();
        queue = [];
        active = new Set();
        enabled = true;
        generation = 0;
        lastStart = 0;
        timer;
        writes = Promise.resolve();
        initialized;
        now;
        constructor(options) {
            this.options = options;
            this.now = options.now || Date.now;
            this.initialized = options.load().then(raw => {
                const data = raw;
                if (data?.version !== 1)
                    return;
                this.cooldownUntil = Number.isFinite(data.cooldownUntil) ? Math.min(data.cooldownUntil, this.now() + 3600000) : 0;
                for (const [id, result] of Object.entries(data.items || {}).slice(-500)) {
                    if (SAFLookup.validId(id) && validResult(result, this.now()) && (result.state !== "unavailable" || data.sessionAware))
                        this.items[id] = result;
                }
            });
        }
        async get(id) {
            if (!SAFLookup.validId(id))
                return unavailable(this.now(), SAFI18n.t("lookup.invalidId"));
            try {
                await this.initialized;
            }
            catch {
                return unavailable(this.now(), SAFI18n.t("lookup.cacheReadFailed"));
            }
            if (!this.enabled)
                return unavailable(this.now(), SAFI18n.t("lookup.disabled"), 0);
            if (fresh(this.items[id], this.now(), this.options.cacheDays ?? 0))
                return this.withPolicy(this.items[id]);
            if (this.cooldownUntil > this.now())
                return unavailable(this.now(), SAFI18n.t("lookup.rateLimited"), this.cooldownUntil - this.now());
            const existing = this.pending.get(id);
            if (existing)
                return existing;
            if (this.queue.length >= 32)
                return unavailable(this.now(), SAFI18n.t("lookup.queued"), 30000);
            const promise = new Promise(resolve => this.queue.push({ id, resolve, generation: this.generation }));
            this.pending.set(id, promise);
            this.pump();
            return promise;
        }
        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled)
                this.cancel();
        }
        configure(policy) {
            this.options.gap = policy.requestGap;
            this.options.concurrency = policy.concurrency;
            this.options.cacheDays = policy.cacheDays;
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = undefined;
            // Lower limits drain active requests naturally; new work observes the latest policy.
            this.pump();
        }
        withPolicy(result) {
            return { ...result, expiresAt: expiresAt(result, this.options.cacheDays ?? 0) };
        }
        cancel() {
            this.generation++;
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = undefined;
            for (const job of this.queue.splice(0))
                job.resolve(unavailable(this.now(), SAFI18n.t("lookup.cancelled"), 0));
            this.pending.clear();
            for (const controller of this.active)
                controller.abort();
        }
        async clear() {
            await this.initialized;
            this.cancel();
            this.items = {};
            // Keep the server's cooldown even when the user clears cached results.
            await this.persist();
        }
        persist() {
            const now = this.now();
            const sorted = Object.entries(this.items).filter(([, r]) => fresh(r, now, this.options.cacheDays ?? 0))
                .map(([id, result]) => [id, this.withPolicy(result)]).sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, 500);
            this.items = Object.fromEntries(sorted);
            const snapshot = { version: 1, items: { ...this.items }, cooldownUntil: this.cooldownUntil, sessionAware: true };
            const write = this.writes.catch(() => undefined).then(() => this.options.save(snapshot));
            this.writes = write;
            return write;
        }
        pump() {
            if (!this.enabled || !this.queue.length || this.active.size >= (this.options.concurrency ?? 2) || this.timer)
                return;
            if (this.cooldownUntil > this.now()) {
                for (const job of this.queue.splice(0)) {
                    this.pending.delete(job.id);
                    job.resolve(unavailable(this.now(), SAFI18n.t("lookup.rateLimited"), this.cooldownUntil - this.now()));
                }
                return;
            }
            const delay = Math.max(0, this.lastStart + (this.options.gap ?? 700) - this.now());
            if (delay) {
                this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, delay);
                return;
            }
            const job = this.queue.shift();
            const controller = new AbortController();
            this.active.add(controller);
            this.lastStart = this.now();
            void this.run(job, controller);
            this.pump();
        }
        async run(job, controller) {
            const timeout = setTimeout(() => controller.abort(), 10000);
            let result;
            try {
                const response = await this.options.fetch(`https://store.steampowered.com/app/${job.id}/?l=english`, {
                    credentials: "include", redirect: "error", signal: controller.signal
                });
                if (response.status === 429 || response.status === 503) {
                    const raw = response.headers.get("Retry-After");
                    const seconds = raw && /^\d+$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) - this.now() : 0;
                    this.cooldownUntil = this.now() + Math.min(3600000, Math.max(60000, Number.isFinite(seconds) ? seconds : 0));
                    result = unavailable(this.now(), SAFI18n.t("lookup.rateLimited"), this.cooldownUntil - this.now());
                }
                else if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
                    result = unavailable(this.now(), SAFI18n.t("lookup.httpFailed", { status: response.status }));
                }
                else {
                    result = parse(await response.text(), job.id, this.now());
                }
            }
            catch {
                result = unavailable(this.now(), SAFI18n.t("lookup.accessFailed"));
            }
            finally {
                clearTimeout(timeout);
            }
            result = this.withPolicy(result);
            if (job.generation === this.generation && this.enabled) {
                this.items[job.id] = result;
                try {
                    await this.persist();
                }
                catch {
                    result = { ...result, issue: SAFI18n.t("lookup.cacheWriteFailed") };
                }
            }
            if (job.generation === this.generation && this.enabled)
                this.pending.delete(job.id);
            else
                result = unavailable(this.now(), SAFI18n.t("lookup.cancelled"), 0);
            this.active.delete(controller);
            job.resolve(result);
            this.pump();
        }
    }
    SAFLookup.Resolver = Resolver;
})(SAFLookup || (SAFLookup = {}));
