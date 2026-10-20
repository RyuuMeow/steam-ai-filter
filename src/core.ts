namespace SAF {
  export type Level = 0 | 1 | 2 | 3;
  export type Presentation = "mask" | "remove";
  export interface Evidence {
    id: string;
    title: string;
    tagMatch: boolean;
    tagAvailable: boolean;
    disclosure: string | null;
    parseIssue: boolean;
  }
  export interface Settings { level: Level; presentation: Presentation; allow: Record<string, string> }
  export type PageKind = "home" | "search" | "app" | "store";
  export interface Status {
    kind: PageKind;
    total: number;
    hidden: number;
    matched: number;
    unknown: number;
    pending?: number;
    checked?: number;
    failed?: number;
    mainMatched?: boolean;
    revealing: boolean;
    presentation: Presentation;
  }
  export const levels = [
    {name: "關閉", description: "保留 Steam 原本的顯示方式。"},
    {name: "標示", description: "標示 AI 相關訊號，保留所有遊戲。"},
    {name: "揭露", description: "遮蔽已披露使用 AI 的遊戲。"},
    {name: "廣泛", description: "遮蔽 AI 揭露與人工智慧標籤。\n標籤也可能只是題材。"}
  ] as const;
  export function normalizeLevel(value: unknown): Level {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3
      ? value as Level : 1;
  }
  export function normalizePresentation(value: unknown): Presentation {
    return value === "remove" ? "remove" : "mask";
  }
  export function cleanAllow(value: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (value && typeof value === "object") {
      for (const [id, title] of Object.entries(value)) {
        if (/^\d+$/.test(id) && typeof title === "string") result[id] = title.slice(0, 200);
      }
    }
    return result;
  }
  export function normalizeText(value: string): string {
    return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  }
  export function isAITag(value: string): boolean {
    return ["人工智慧", "人工智能", "artificial intelligence"].includes(normalizeText(value));
  }
  export function isDisclosureHeading(value: string): boolean {
    return [
      "ai generated content disclosure", "ai-generated content disclosure",
      "ai 生成內容聲明", "ai 生成内容声明", "ai 生成内容披露"
    ].includes(normalizeText(value));
  }
  export function parseTagIds(raw: string | null): {ids: string[]; issue: boolean} {
    if (raw === null) return {ids: [], issue: false};
    try {
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data) || data.some(x => !/^\d+$/.test(String(x)))) {
        return {ids: [], issue: true};
      }
      return {ids: data.map(String), issue: false};
    } catch { return {ids: [], issue: true}; }
  }
  export function shouldHide(e: Evidence, level: Level, allow: Record<string, string>): boolean {
    if (Object.hasOwn(allow, e.id) || level < 2) return false;
    return Boolean(e.disclosure) || (level === 3 && e.tagMatch);
  }
  export function reason(e: Evidence): string {
    if (e.disclosure && e.tagMatch) return "AI 使用揭露 · 人工智慧標籤";
    if (e.disclosure) return "AI 使用揭露";
    if (e.tagMatch) return "人工智慧標籤";
    return e.parseIssue ? "資料讀取異常" : "本頁資訊不足";
  }
  export function readDisclosure(scope: ParentNode): string | null {
    // Steam uses the same descriptor ID for mature and AI content. Check the heading.
    for (const section of scope.querySelectorAll("#game_area_content_descriptors, .game_area_description")) {
      const heading = section.querySelector("h2");
      if (!heading || !isDisclosureHeading(heading.textContent || "")) continue;
      const quote = section.querySelector("i");
      const text = (quote ? quote.innerText || quote.textContent || "" : section.textContent || "").trim();
      if (text) return text;
    }
    return null;
  }
  export function readEvidence(scope: Element | Document, id: string, title: string): Evidence {
    const raw = scope instanceof Element ? scope.getAttribute("data-ds-tagids") : null;
    const parsed = parseTagIds(raw);
    const nested = Array.from(scope.querySelectorAll("[data-ds-tagids]"))
      .filter(e => directCardId(e) === id).map(e => parseTagIds(e.getAttribute("data-ds-tagids")));
    // Scope to product tags only. Never inspect search-sidebar tag controls.
    const tagScope = scope instanceof Document ? scope.querySelector(`.glance_tags[data-appid="${id}"]`) : scope;
    const tags = Array.from(tagScope?.querySelectorAll(".app_tag, .tab_item_tags .top_tag, .tab_item_top_tags .top_tag") || []);
    return {
      id, title, tagMatch: parsed.ids.includes("7926") || nested.some(p => p.ids.includes("7926")) || tags.some(e => isAITag((e.textContent || "").replace(/^[,\s，]+/, ""))),
      tagAvailable: raw !== null || nested.length > 0 || tags.length > 0,
      disclosure: readDisclosure(scope),
      parseIssue: parsed.issue || nested.some(p => p.issue)
    };
  }
  // Labels only: no store path is excluded from card discovery.
  export function pageKind(path: string): PageKind {
    if (path === "/") return "home";
    if (/^\/search\/?$/.test(path)) return "search";
    if (/^\/app\/\d+(?:\/|$)/.test(path)) return "app";
    return "store";
  }
  function hrefId(href: string | null): string | null {
    if (!href) return null;
    try {
      const url = new URL(href, location.href);
      if (url.hostname !== "store.steampowered.com" && url.origin !== location.origin) return null;
      return url.pathname.match(/^\/app\/([1-9]\d{0,9})(?:\/|$)/)?.[1] || null;
    } catch { return null; }
  }
  const ownerSelector = "a[href], [data-ds-appid], [data-appid], [data-app-id], [data-ds-itemkey]";
  const boundary = "body, html, main, [role=main], [role=list], .responsive_page_template_content, .home_page_content, .home_ctn, #search_resultsRows";
  const excluded = "#saf-root, .saf-badge, .saf-mask, #global_header, #global_action_menu, #store_header, #footer, nav, [role=navigation], [data-featuretarget=footer]";
  function directCardId(element: Element): string | null {
    // An explicit non-app URL (bundle, package or external) wins over incidental data.
    if (element.matches("a[href]")) return hrefId(element.getAttribute("href"));
    for (const name of ["data-ds-appid", "data-appid", "data-app-id"]) {
      const id = element.getAttribute(name);
      if (id && /^[1-9]\d{0,9}$/.test(id)) return id;
    }
    return element.getAttribute("data-ds-itemkey")?.match(/^App_([1-9]\d{0,9})$/i)?.[1] || null;
  }
  function ownerIds(element: Element): Set<string> {
    const ids = new Set<string>();
    const own = directCardId(element);
    if (own) ids.add(own);
    for (const child of element.querySelectorAll(ownerSelector)) {
      const id = directCardId(child);
      if (id) ids.add(id);
      if (ids.size > 1) break;
    }
    return ids;
  }
  export function cardId(card: Element): string | null {
    const ids = ownerIds(card);
    return ids.size === 1 ? [...ids][0] : null;
  }
  export function collectCards(root: Document, _kind?: PageKind): Element[] {
    const metadata = new Map<Element, {ids: Set<string>; media: number}>();
    const info = (el: Element) => {
      if (!metadata.has(el)) metadata.set(el, {ids: ownerIds(el), media: el.querySelectorAll("img, video, [style*='background-image']").length});
      return metadata.get(el)!;
    };
    const candidates = new Set<Element>();
    for (const element of root.querySelectorAll(ownerSelector)) {
      if (element.matches(boundary) || element.closest(excluded)) continue;
      const id = directCardId(element);
      if (!id || info(element).ids.size !== 1) continue;
      const media = info(element).media || (element instanceof HTMLElement && Boolean(element.style.backgroundImage) ? 1 : 0);
      const known = element.matches(".search_result_row, .store_main_capsule, .sale_capsule, .tab_row_item, .tab_item, .home_smallcap, .small_cap, .wishlist_row");
      if (!media && !known) continue;
      let card = element, mediaCount = media;
      // Expand to the single-game artwork group. Stop at mixed-game shelves, page
      // roots or navigation so a recommendation can never cover its neighbours.
      for (let parent = element.parentElement, depth = 0; parent && depth < 6; parent = parent.parentElement, depth++) {
        if (parent.matches(boundary) || parent.closest(excluded)) break;
        const details = info(parent);
        if (details.ids.size !== 1 || !details.ids.has(id)) break;
        if (parent.querySelector("a[href*='/bundle/'], a[href*='/sub/'], nav, [role=navigation]")) break;
        const extraMedia = [...parent.querySelectorAll("img, video, [style*='background-image']")].filter(m => !card.contains(m));
        const sameGameAssets = extraMedia.length > 0 && extraMedia.every(m => {
          const source = m.getAttribute("data-image-url") || m.getAttribute("src") || m.getAttribute("poster") || m.getAttribute("style") || "";
          return source.match(/\/steam\/apps\/([1-9]\d{0,9})\//)?.[1] === id;
        });
        if ((details.media > mediaCount && sameGameAssets) || directCardId(parent) === id) { card = parent; mediaCount = details.media; }
      }
      candidates.add(card);
    }
    return [...candidates].filter(card => {
      for (let parent = card.parentElement; parent; parent = parent.parentElement) if (candidates.has(parent)) return false;
      return true;
    });
  }
  export function cardTitle(card: Element, id: string): string {
    return card.querySelector(".title, .app_name, .tab_item_title, .tab_item_name, .recommendation_title")?.textContent?.trim()
      || card.querySelector("img[alt]")?.getAttribute("alt")?.trim() || `App ${id}`;
  }
  export function mergeEvidence(entries: Iterable<[Element, Evidence]>): Map<Element, Evidence> {
    const all = Array.from(entries), byId = new Map<string, Evidence>();
    for (const [, e] of all) {
      const other = byId.get(e.id);
      byId.set(e.id, other ? {...e, tagMatch: other.tagMatch || e.tagMatch,
        disclosure: other.disclosure || e.disclosure, tagAvailable: other.tagAvailable || e.tagAvailable,
        parseIssue: other.parseIssue || e.parseIssue} : e);
    }
    // Merge afresh on every render so removed signals never remain sticky.
    return new Map(all.map(([el, e]) => [el, {...byId.get(e.id)!, title: e.title}]));
  }
  export async function getSettings(): Promise<Settings> {
    const data = await chrome.storage.local.get(["level", "presentation", "allow"]);
    return {level: normalizeLevel(data.level), presentation: normalizePresentation(data.presentation), allow: cleanAllow(data.allow)};
  }
}
