namespace SAF {
  export type Mode = "off" | "mark" | "mask" | "hide";
  export type Presentation = "mask" | "remove";
  export interface Evidence {
    id: string;
    title: string;
    tagMatch: boolean;
    tagAvailable: boolean;
    disclosure: string | null;
    parseIssue: boolean;
  }
  export type FilterCategory = SAFDisclosure.Category | "unknown";
  export const filterCategories: readonly FilterCategory[] = [...SAFDisclosure.categories, "unknown"];
  export const categoryLabel = (category: FilterCategory): string => category === "unknown" ? "用途不明" : SAFDisclosure.packs[category].label;
  export type FilterCategories = Record<FilterCategory, boolean>;
  export interface Settings {
    mode: Mode; filterCategories: FilterCategories; autoIgnore: boolean; showChecked: boolean;
    allow: Record<string, string>; requestGap: number; concurrency: number; cacheDays: SAFLookup.CacheDays;
  }
  export const settingKeys = ["mode", "level", "presentation", "filterCategories", "autoIgnore", "showChecked", "allow", "requestGap", "concurrency", "cacheDays"];
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
  export const modes = [
    {id: "off", name: "關閉", description: "停止檢查，保留 Steam 原本的顯示方式。"},
    {id: "mark", name: "標記", description: "為符合所選用途的遊戲加上標籤。"},
    {id: "mask", name: "遮蔽", description: "遮蔽符合所選用途的遊戲，保留卡片位置。"},
    {id: "hide", name: "隱藏", description: "隱藏符合所選用途的遊戲，收起卡片空間。"}
  ] as const;
  export function normalizeMode(value: unknown): Mode {
    return modes.find(mode => mode.id === value)?.id || "mask";
  }
  export function presentation(mode: Mode): Presentation {
    return mode === "hide" ? "remove" : "mask";
  }
  export function filters(mode: Mode): boolean { return mode === "mask" || mode === "hide"; }
  export function normalizeSettings(data: Record<string, unknown> = {}): Settings {
    // A separate key prevents old broad=3 from silently becoming the new hide mode.
    const legacyMode = data.level === 0 ? "off" : data.level === 1 ? "mark" : data.presentation === "remove" ? "hide" : "mask";
    return {mode: data.mode === undefined ? legacyMode : normalizeMode(data.mode),
      filterCategories: normalizeCategories(data.filterCategories), autoIgnore: data.autoIgnore === true,
      showChecked: data.showChecked !== false, allow: cleanAllow(data.allow),
      requestGap: [700, 1000, 2000, 5000].includes(data.requestGap as number) ? data.requestGap as number : 700,
      concurrency: [1, 2, 3, 4].includes(data.concurrency as number) ? data.concurrency as number : 2,
      cacheDays: data.cacheDays === 1 || data.cacheDays === 7 || data.cacheDays === 30 ? data.cacheDays : 0};
  }
  export function normalizeCategories(value?: unknown): FilterCategories {
    const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    return Object.fromEntries(filterCategories.map(category =>
      [category, saved ? saved[category] === true : category === "art"])) as FilterCategories;
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
  export function matchesUses(e: Evidence, allow: Record<string, string>, selected = normalizeCategories()): boolean {
    if (Object.hasOwn(allow, e.id) || !e.disclosure?.trim()) return false;
    const uses = SAFDisclosure.classifyUses(e.disclosure);
    return uses.length ? uses.some(category => selected[category]) : selected.unknown;
  }
  export function shouldHide(e: Evidence, mode: Mode, allow: Record<string, string>, selected = normalizeCategories()): boolean {
    return filters(mode) && matchesUses(e, allow, selected);
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
      const text = (quote ? quote.innerText || quote.textContent || ""
        : (section.textContent || "").replace(heading.textContent || "", "")).trim();
      if (text) return text;
    }
    return null;
  }
  export function readEvidence(scope: Element | Document, id: string, title: string): Evidence {
    // A homepage recommendation's reason describes a different, previously played
    // game. Only its product gallery contributes tags/disclosure to this card.
    if (scope instanceof Element) scope = singleRecommendation(scope)?.gallery || scope;
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
  function rawOwnerIds(element: Element, ignored: Element | null = null): Set<string> {
    const ids = new Set<string>();
    const own = directCardId(element);
    if (own) ids.add(own);
    for (const child of element.querySelectorAll(ownerSelector)) {
      if (ignored?.contains(child)) continue;
      const id = directCardId(child);
      if (id) ids.add(id);
      if (ids.size > 1) break;
    }
    return ids;
  }
  function singleRecommendation(element: Element): {id: string; gallery: Element} | null {
    if (!element.matches(".home_content.single")) return null;
    const galleries = element.querySelectorAll(":scope > .home_content_items");
    const headers = element.querySelectorAll(":scope > .single_header_ctn");
    if (galleries.length !== 1 || headers.length !== 1) return null;
    const reasons = headers[0].querySelectorAll(":scope > .single_title_ctn > .home_content_reason");
    if (reasons.length > 1) return null;
    const reason = reasons[0] || null;
    // Only a text reference is exempt. Extra artwork or another actual game card
    // must retain the mixed-game protection.
    if (reason?.querySelector("img, video, [style*='background-image'], [data-ds-appid], [data-appid], [data-app-id], [data-ds-itemkey]")) return null;
    const gallery = galleries[0], ids = rawOwnerIds(gallery);
    if (ids.size !== 1) return null;
    const id = [...ids][0], rest = rawOwnerIds(element, reason);
    return rest.size === 1 && rest.has(id) ? {id, gallery} : null;
  }
  function ownerIds(element: Element): Set<string> {
    const single = singleRecommendation(element);
    return single ? new Set([single.id]) : rawOwnerIds(element);
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
      for (let parent = element.parentElement, depth = 0; parent && depth < 12; parent = parent.parentElement, depth++) {
        if (parent.matches(boundary) || parent.closest(excluded)) break;
        const details = info(parent);
        if (details.ids.size !== 1 || !details.ids.has(id)) break;
        if (parent.querySelector("a[href*='/bundle/'], a[href*='/sub/'], nav, [role=navigation]")) break;
        const extraMedia = [...parent.querySelectorAll("img, video, [style*='background-image']")].filter(m => !card.contains(m));
        const sameGameAssets = extraMedia.length > 0 && extraMedia.every(m => {
          const source = m.getAttribute("data-image-url") || m.getAttribute("src") || m.getAttribute("poster") || m.getAttribute("style") || "";
          return source.match(/\/steam\/apps\/([1-9]\d{0,9})\//)?.[1] === id;
        });
        // Steam's expanded card contains trailers with separate movie IDs. The
        // explicit game-card boundary is stronger evidence than media URL equality.
        const single = singleRecommendation(parent);
        const wholeObject = Boolean(single) || parent.matches(".LibraryAssetExpandedDisplay, .carousel__slide, .trailercarousel");
        if (wholeObject || (details.media > mediaCount && sameGameAssets) || directCardId(parent) === id) { card = parent; mediaCount = details.media; }
        if (single || parent.matches(".carousel__slide, .trailercarousel")) break;
      }
      candidates.add(card);
    }
    return [...candidates].filter(card => {
      for (let parent = card.parentElement; parent; parent = parent.parentElement) if (candidates.has(parent)) return false;
      return true;
    });
  }
  export function removalContainer(card: Element): Element {
    if (singleRecommendation(card)) {
      const wrapper = card.parentElement;
      return wrapper?.matches(".home_content_single_ctn") && wrapper.children.length === 1 ? wrapper : card;
    }
    if (!card.matches(".LibraryAssetExpandedDisplay")) return card;
    const row = card.closest(".SaleSectionContainer");
    // A section can also contain several games: only collapse a single expanded row.
    return row && row.querySelectorAll(".LibraryAssetExpandedDisplay").length === 1
      && !row.querySelector("nav, [role=navigation], h1, h2") && cardId(row) === cardId(card) ? row : card;
  }
  export function cardTitle(card: Element, id: string): string {
    return card.querySelector(".title, .app_name, .tab_item_title, .tab_item_name, .recommendation_title, .single_title")?.textContent?.trim()
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
    return normalizeSettings(await chrome.storage.local.get(settingKeys));
  }
}
