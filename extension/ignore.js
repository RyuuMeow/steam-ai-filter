"use strict";
var SAFIgnore;
(function (SAFIgnore) {
    SAFIgnore.interval = 30000;
    const lifetime = 15 * 60000;
    const origin = "https://store.steampowered.com";
    class Failure extends Error {
        kind;
        until;
        constructor(message, kind, until = 0) {
            super(message);
            this.kind = kind;
            this.until = until;
        }
    }
    function validAccount(value) { return typeof value === "string" && /^[1-9]\d{0,9}$/.test(value); }
    function evidence(value) {
        if (!value || typeof value !== "object")
            return null;
        const e = value;
        if (!SAFLookup.validId(e.id))
            return null;
        return { id: e.id, title: typeof e.title === "string" ? e.title.slice(0, 200) : `App ${e.id}`,
            tagMatch: e.tagMatch === true, tagAvailable: e.tagAvailable === true, parseIssue: e.parseIssue === true,
            disclosure: typeof e.disclosure === "string" && e.disclosure.trim() ? e.disclosure.slice(0, 2000) : null };
    }
    SAFIgnore.evidence = evidence;
    function blank() {
        return { version: 1, accountId: "", queue: [], done: {}, nextAt: 0, cooldownUntil: 0, paused: "", last: "" };
    }
    // Session material lives only in this call chain, never in storage, messages or logs.
    function parseSession(html) {
        const accountId = html.match(/\bg_AccountID\s*=\s*(\d+)\s*;/)?.[1];
        const sessionid = html.match(/\bg_sessionID\s*=\s*["']([a-zA-Z0-9]{12,128})["']\s*;/)?.[1];
        if (!validAccount(accountId))
            throw new Failure("請先登入 Steam，再關閉並開啟自動不感興趣。", "pause");
        if (!sessionid)
            throw new Failure("無法確認 Steam 登入狀態，已暫停。", "pause");
        return { accountId, sessionid };
    }
    SAFIgnore.parseSession = parseSession;
    class Service {
        deps;
        state = blank();
        loaded = false;
        serial = Promise.resolve();
        now;
        constructor(deps) {
            this.deps = deps;
            this.now = deps.now || Date.now;
        }
        run(fn) {
            const task = this.serial.then(async () => {
                await this.load();
                const shared = await this.deps.cooldown?.();
                if (typeof shared === "number" && Number.isFinite(shared))
                    this.state.cooldownUntil = Math.max(this.state.cooldownUntil, shared);
                return fn();
            });
            this.serial = task.catch(() => undefined);
            return task;
        }
        async load() {
            if (this.loaded)
                return;
            const raw = await this.deps.load();
            if (raw?.version === 1) {
                this.state.accountId = validAccount(raw.accountId) ? raw.accountId : "";
                for (const field of ["nextAt", "cooldownUntil"]) {
                    if (typeof raw[field] === "number" && Number.isFinite(raw[field]) && raw[field] > 0)
                        this.state[field] = raw[field];
                }
                this.state.paused = typeof raw.paused === "string" ? raw.paused.slice(0, 200) : "";
                this.state.last = typeof raw.last === "string" ? raw.last.slice(0, 250) : "";
                const seen = new Set();
                for (const item of Array.isArray(raw.queue) ? raw.queue.slice(0, 200) : []) {
                    const e = evidence(item);
                    if (!e || seen.has(e.id) || !(item.expiresAt > this.now()))
                        continue;
                    seen.add(e.id);
                    this.state.queue.push({ ...e, expiresAt: Math.min(item.expiresAt, this.now() + lifetime),
                        attempts: Number.isInteger(item.attempts) && item.attempts >= 0 ? Math.min(item.attempts, 3) : 0 });
                }
                for (const [id, time] of Object.entries(raw.done || {}).slice(0, 5000)) {
                    if (SAFLookup.validId(id) && typeof time === "number" && Number.isFinite(time))
                        this.state.done[id] = time;
                }
            }
            this.loaded = true;
        }
        async persist(enabled) {
            await this.deps.save(structuredClone(this.state), enabled);
        }
        active(settings) { return settings.autoIgnore && settings.level >= 2; }
        async allowed(item, settings, snapshot) {
            const cache = (snapshot || await this.deps.cache())[item.id];
            if (cache?.state === "disclosed" && SAFLookup.fresh(cache, this.now()))
                item.disclosure = cache.disclosure;
            return this.active(settings) && item.expiresAt > this.now()
                && SAF.shouldHide(item, settings.level, settings.allow, settings.filterCategories);
        }
        async prune(settings) {
            const cache = await this.deps.cache();
            const next = [];
            for (const item of this.state.queue)
                if (!Object.hasOwn(this.state.done, item.id) && await this.allowed(item, settings, cache))
                    next.push(item);
            this.state.queue = next;
        }
        async schedule() {
            const settings = await this.deps.settings();
            const when = this.active(settings) && this.state.queue.length && !this.state.paused
                ? Math.max(this.now() + SAFIgnore.interval, this.state.nextAt, this.state.cooldownUntil) : null;
            await this.deps.schedule(when);
        }
        async enable() {
            return this.run(async () => {
                try {
                    const session = await this.session();
                    if (this.state.accountId !== session.accountId) {
                        // Account changes never carry candidates or deduplication to another user.
                        const cooldown = this.state.cooldownUntil, next = this.state.nextAt;
                        this.state = { ...blank(), cooldownUntil: cooldown, nextAt: next };
                    }
                    this.state.accountId = session.accountId;
                    this.state.paused = "";
                    this.state.nextAt = Math.max(this.state.nextAt, this.now() + SAFIgnore.interval);
                    for (const item of this.state.queue)
                        item.attempts = 0;
                    await this.persist(true);
                    await this.schedule();
                    return { ok: true };
                }
                catch (error) {
                    if (error instanceof Failure && error.kind === "rate") {
                        this.state.cooldownUntil = Math.max(this.state.cooldownUntil, error.until);
                        await this.persist();
                    }
                    return { ok: false, issue: error instanceof Failure ? error.message : "無法連線至 Steam，設定未開啟。" };
                }
            });
        }
        async reconcile() {
            return this.run(async () => {
                const settings = await this.deps.settings();
                await this.prune(settings);
                if (settings.autoIgnore && !this.state.accountId)
                    this.state.paused = "請關閉再開啟自動不感興趣，以確認 Steam 帳號。";
                await this.persist();
                await this.schedule();
            });
        }
        async enqueue(values) {
            return this.run(async () => {
                const settings = await this.deps.settings();
                if (!this.active(settings) || !this.state.accountId || this.state.paused || !Array.isArray(values))
                    return;
                await this.prune(settings);
                const cache = await this.deps.cache();
                for (const raw of values.slice(0, 1000)) {
                    const e = evidence(raw);
                    if (!e || Object.hasOwn(this.state.done, e.id))
                        continue;
                    const old = this.state.queue.find(item => item.id === e.id);
                    if (!SAF.shouldHide(e, settings.level, settings.allow, settings.filterCategories)) {
                        if (old)
                            this.state.queue = this.state.queue.filter(item => item !== old);
                        continue;
                    }
                    // A newer explicit disclosure supersedes a previous tag-only sighting.
                    if (old) {
                        if (e.disclosure)
                            old.disclosure = e.disclosure;
                        old.tagMatch = e.tagMatch;
                        if (!await this.allowed(old, settings, cache))
                            this.state.queue = this.state.queue.filter(item => item !== old);
                        continue;
                    }
                    const item = { ...e, expiresAt: this.now() + lifetime, attempts: 0 };
                    if (this.state.queue.length < 200 && await this.allowed(item, settings, cache))
                        this.state.queue.push(item);
                }
                await this.persist();
                await this.schedule();
            });
        }
        async response(url, init) {
            let response;
            try {
                response = await this.deps.fetch(url, { ...init, credentials: "include", cache: "no-store",
                    redirect: "error", signal: AbortSignal.timeout(12000) });
            }
            catch {
                throw new Failure("Steam 連線失敗，稍後重試。", "retry");
            }
            if (response.status === 429 || response.status === 503) {
                const header = response.headers.get("Retry-After") || "";
                const retry = /^\d+$/.test(header) ? this.now() + Number(header) * 1000 : Date.parse(header);
                throw new Failure("Steam 要求稍後重試，自動不感興趣已暫停等待。", "rate", Math.max(this.now() + 15 * 60000, Number.isFinite(retry) ? retry : 0));
            }
            if (response.status === 401 || response.status === 403)
                throw new Failure("Steam 拒絕操作；請確認登入狀態後關閉再開啟。", "pause");
            if (!response.ok)
                throw new Failure("Steam 暫時無法完成操作。", response.status >= 500 ? "retry" : "pause");
            return response;
        }
        async session() {
            const response = await this.response(origin + "/");
            const html = await response.text();
            return parseSession(html);
        }
        async ignored(accountId) {
            const response = await this.response(`${origin}/dynamicstore/userdata/?id=${accountId}&v=${this.now()}`);
            let data;
            try {
                data = await response.json();
            }
            catch {
                throw new Failure("無法讀取 Steam 忽略清單，已暫停。", "pause");
            }
            const ignored = data.rgIgnoredApps;
            if (!ignored || typeof ignored !== "object" || (Array.isArray(ignored) && ignored.length > 0))
                throw new Failure("Steam 忽略清單格式已變更，已暫停。", "pause");
            return ignored;
        }
        complete(item, already) {
            this.state.done[item.id] = this.now();
            this.state.queue = this.state.queue.filter(i => i.id !== item.id);
            this.state.last = `${already ? "已在忽略清單" : "已忽略"}：${item.title}`;
        }
        async tick() {
            return this.run(async () => {
                const settings = await this.deps.settings();
                await this.prune(settings);
                if (!this.active(settings) || !this.state.queue.length || this.state.paused) {
                    await this.persist();
                    await this.schedule();
                    return;
                }
                if (!this.state.accountId) {
                    this.state.paused = "請關閉再開啟自動不感興趣，以確認 Steam 帳號。";
                    await this.persist();
                    await this.schedule();
                    return;
                }
                if (Math.max(this.state.nextAt, this.state.cooldownUntil) > this.now()) {
                    await this.schedule();
                    return;
                }
                if (Object.keys(this.state.done).length >= 5000) {
                    this.state.paused = "本機忽略紀錄已達上限，已停止自動操作。";
                    await this.persist();
                    await this.schedule();
                    return;
                }
                const item = this.state.queue[0];
                // Persist the rate reservation before any request; worker restarts cannot burst.
                this.state.nextAt = this.now() + SAFIgnore.interval;
                await this.persist();
                try {
                    const session = await this.session();
                    if (session.accountId !== this.state.accountId) {
                        this.state.queue = [];
                        throw new Failure("Steam 帳號已變更；請關閉再開啟自動不感興趣。", "pause");
                    }
                    if (!await this.allowed(item, await this.deps.settings())) {
                        this.state.queue = this.state.queue.filter(i => i !== item);
                    }
                    else if (Object.hasOwn(await this.ignored(session.accountId), item.id)) {
                        this.complete(item, true);
                    }
                    else if (await this.allowed(item, await this.deps.settings())) {
                        await this.response(origin + "/recommended/ignorerecommendation/", {
                            method: "POST", body: new URLSearchParams({ sessionid: session.sessionid, appid: item.id, remove: "0" })
                        });
                        // A 200 alone is insufficient: confirm the item in Steam's authoritative list.
                        if (!Object.hasOwn(await this.ignored(session.accountId), item.id))
                            throw new Failure("Steam 尚未確認忽略結果，稍後重新確認。", "retry");
                        this.complete(item, false);
                    }
                    else {
                        this.state.queue = this.state.queue.filter(i => i !== item);
                    }
                }
                catch (error) {
                    const failure = error instanceof Failure ? error : new Failure("Steam 回應讀取失敗，稍後重新確認。", "retry");
                    if (failure.kind === "rate") {
                        this.state.cooldownUntil = Math.max(this.state.cooldownUntil, failure.until);
                        this.state.last = failure.message;
                    }
                    else if (failure.kind === "pause") {
                        this.state.paused = failure.message;
                    }
                    else {
                        item.attempts++;
                        this.state.last = failure.message;
                        if (item.attempts >= 3)
                            this.state.paused = "連續操作失敗，已暫停。請確認 Steam 後關閉再開啟。";
                        else
                            this.state.nextAt = this.now() + (item.attempts === 1 ? 2 : 10) * 60000;
                    }
                }
                // Off/level/allowlist changes made during the request also clear pending work.
                await this.prune(await this.deps.settings());
                await this.persist();
                await this.schedule();
            });
        }
    }
    SAFIgnore.Service = Service;
})(SAFIgnore || (SAFIgnore = {}));
