namespace SAFLookup {
  export type State = "disclosed" | "not-found" | "unavailable";
  export interface Result { state: State; disclosure: string | null; checkedAt: number; expiresAt: number; issue?: string }
  export interface Stored { version: 1; items: Record<string, Result>; cooldownUntil: number; sessionAware?: boolean }
  export const validId = (id: unknown): id is string => typeof id === "string" && /^[1-9]\d{0,9}$/.test(id);
  const DAY = 86400000;
  export function unavailable(now: number, issue: string, retry = 300000): Result {
    return {state: "unavailable", disclosure: null, checkedAt: now, expiresAt: now + retry, issue};
  }
  export function fresh(value: unknown, now: number): value is Result {
    if (!value || typeof value !== "object") return false;
    const r = value as Result;
    return ["disclosed", "not-found", "unavailable"].includes(r.state) &&
      Number.isFinite(r.checkedAt) && r.checkedAt <= now && Number.isFinite(r.expiresAt) &&
      r.expiresAt > now && r.expiresAt <= now + 7 * DAY &&
      (r.state === "disclosed" ? typeof r.disclosure === "string" && r.disclosure.length > 0 && r.disclosure.length <= 2000 : r.disclosure === null);
  }
  function plain(html: string): string {
    const entities: Record<string, string> = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "};
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
      .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, key: string) => {
        if (!key.startsWith("#")) return entities[key.toLowerCase()] || raw;
        const point = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "\uFFFD";
      }).replace(/[ \t]+/g, " ").trim();
  }
  // Parse only the server-rendered descriptor section. No remote HTML is ever executed.
  export function parse(html: string, id: string, now: number): Result {
    if (!validId(id) || html.length > 4000000) return unavailable(now, "頁面格式無法確認");
    const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    const metas = clean.match(/<meta\b[^>]*>/gi) || [];
    const identity = metas.some(meta => /\bproperty\s*=\s*["']og:url["']/i.test(meta) &&
      new RegExp(`\\bcontent\\s*=\\s*["']https://store\\.steampowered\\.com/app/${id}(?:/|[?"'])`, "i").test(meta));
    const complete = identity && /\bid\s*=\s*["']appHubAppName["']/i.test(clean) &&
      /\bid\s*=\s*["']game_area_description["']/i.test(clean) &&
      /<\/body\s*>\s*<\/html\s*>/i.test(clean);
    if (!complete) return unavailable(now, "商品頁不完整或需要驗證");
    const sections = clean.matchAll(/<div\b[^>]*\bid\s*=\s*["']game_area_content_descriptors["'][^>]*>([\s\S]*?)<\/div\s*>/gi);
    for (const section of sections) {
      const heading = section[1].match(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i);
      if (!heading || !/^ai[- ]generated content disclosure$/i.test(plain(heading[1]).replace(/\s+/g, " "))) continue;
      const quote = section[1].match(/<i\b[^>]*>([\s\S]*?)<\/i\s*>/i);
      // A heading with a changed/missing body is unknown, never a negative result.
      const disclosure = quote ? plain(quote[1]).slice(0, 2000) : "";
      if (!disclosure) return unavailable(now, "披露區塊格式無法讀取");
      return {state: "disclosed", disclosure, checkedAt: now, expiresAt: now + 7 * DAY};
    }
    // A familiar heading outside the expected structure means the adapter needs updating.
    if (/AI[- ]Generated Content Disclosure/i.test(clean)) return unavailable(now, "披露區塊格式已變更");
    return {state: "not-found", disclosure: null, checkedAt: now, expiresAt: now + DAY};
  }
  interface Options {
    load: () => Promise<unknown>;
    save: (data: Stored) => Promise<void>;
    fetch: (url: string, init: RequestInit) => Promise<Response>;
    now?: () => number;
    gap?: number;
  }
  interface Job { id: string; resolve: (result: Result) => void; generation: number }
  export class Resolver {
    private items: Record<string, Result> = {};
    private cooldownUntil = 0;
    private pending = new Map<string, Promise<Result>>();
    private queue: Job[] = [];
    private active = new Set<AbortController>();
    private enabled = true;
    private generation = 0;
    private lastStart = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private writes = Promise.resolve();
    private initialized: Promise<void>;
    private now: () => number;
    constructor(private options: Options) {
      this.now = options.now || Date.now;
      this.initialized = options.load().then(raw => {
        const data = raw as Stored | undefined;
        if (data?.version !== 1) return;
        this.cooldownUntil = Number.isFinite(data.cooldownUntil) ? Math.min(data.cooldownUntil, this.now() + 3600000) : 0;
        for (const [id, result] of Object.entries(data.items || {}).slice(-500)) {
          if (validId(id) && fresh(result, this.now()) && (result.state !== "unavailable" || data.sessionAware)) this.items[id] = result;
        }
      });
    }
    async get(id: string): Promise<Result> {
      if (!validId(id)) return unavailable(this.now(), "無效遊戲 ID");
      try { await this.initialized; } catch { return unavailable(this.now(), "快取讀取失敗"); }
      if (!this.enabled) return unavailable(this.now(), "過濾已關閉", 0);
      if (fresh(this.items[id], this.now())) return this.items[id];
      if (this.cooldownUntil > this.now()) return unavailable(this.now(), "Steam 暫時限制查詢", this.cooldownUntil - this.now());
      const existing = this.pending.get(id);
      if (existing) return existing;
      if (this.queue.length >= 32) return unavailable(this.now(), "查詢排隊中", 30000);
      const promise = new Promise<Result>(resolve => this.queue.push({id, resolve, generation: this.generation}));
      this.pending.set(id, promise); this.pump();
      return promise;
    }
    setEnabled(enabled: boolean) {
      this.enabled = enabled;
      if (!enabled) this.cancel();
    }
    private cancel() {
      this.generation++;
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      for (const job of this.queue.splice(0)) job.resolve(unavailable(this.now(), "查詢已取消", 0));
      this.pending.clear();
      for (const controller of this.active) controller.abort();
    }
    async clear() {
      await this.initialized;
      this.cancel(); this.items = {};
      // Keep the server's cooldown even when the user clears cached results.
      await this.persist();
    }
    private persist(): Promise<void> {
      const now = this.now();
      const sorted = Object.entries(this.items).filter(([, r]) => fresh(r, now)).sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, 500);
      this.items = Object.fromEntries(sorted);
      const snapshot: Stored = {version: 1, items: {...this.items}, cooldownUntil: this.cooldownUntil, sessionAware: true};
      const write = this.writes.catch(() => undefined).then(() => this.options.save(snapshot));
      this.writes = write;
      return write;
    }
    private pump() {
      if (!this.enabled || !this.queue.length || this.active.size >= 2 || this.timer) return;
      if (this.cooldownUntil > this.now()) {
        for (const job of this.queue.splice(0)) {
          this.pending.delete(job.id);
          job.resolve(unavailable(this.now(), "Steam 暫時限制查詢", this.cooldownUntil - this.now()));
        }
        return;
      }
      const delay = Math.max(0, this.lastStart + (this.options.gap ?? 700) - this.now());
      if (delay) {
        this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, delay);
        return;
      }
      const job = this.queue.shift()!;
      const controller = new AbortController();
      this.active.add(controller); this.lastStart = this.now();
      void this.run(job, controller);
      this.pump();
    }
    private async run(job: Job, controller: AbortController) {
      const timeout = setTimeout(() => controller.abort(), 10000);
      let result: Result;
      try {
        const response = await this.options.fetch(`https://store.steampowered.com/app/${job.id}/?l=english`, {
          credentials: "include", redirect: "error", signal: controller.signal
        });
        if (response.status === 429 || response.status === 503) {
          const raw = response.headers.get("Retry-After");
          const seconds = raw && /^\d+$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) - this.now() : 0;
          this.cooldownUntil = this.now() + Math.min(3600000, Math.max(60000, Number.isFinite(seconds) ? seconds : 0));
          result = unavailable(this.now(), "Steam 暫時限制查詢", this.cooldownUntil - this.now());
        } else if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
          result = unavailable(this.now(), `商品頁讀取失敗（${response.status}）`);
        } else {
          result = parse(await response.text(), job.id, this.now());
        }
      } catch {
        result = unavailable(this.now(), "頁面需要驗證、連線逾時或暫時無法存取");
      } finally { clearTimeout(timeout); }
      if (job.generation === this.generation && this.enabled) {
        this.items[job.id] = result;
        try { await this.persist(); } catch { result = {...result, issue: "結果未能寫入快取"}; }
      }
      if (job.generation === this.generation && this.enabled) this.pending.delete(job.id);
      else result = unavailable(this.now(), "查詢已取消", 0);
      this.active.delete(controller); job.resolve(result); this.pump();
    }
  }
}
