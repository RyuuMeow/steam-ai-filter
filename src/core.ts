namespace SAF {
  export type Level = 0 | 1 | 2 | 3;
  export interface Evidence {
    id: string;
    title: string;
    tagMatch: boolean;
    tagAvailable: boolean;
    disclosure: string | null;
    parseIssue: boolean;
  }
  export interface Settings { level: Level; allow: Record<string, string> }
  export interface Status {
    kind: "search" | "app";
    total: number;
    hidden: number;
    matched: number;
    unknown: number;
    revealing: boolean;
  }
  export const levels = [
    {name: "關閉", description: "保留 Steam 原本的顯示方式。"},
    {name: "標示", description: "標出 AI 揭露與人工智慧標籤，保留所有遊戲。"},
    {name: "揭露", description: "隱藏本頁提供明確 AI 使用揭露的遊戲。"},
    {name: "廣泛", description: "同時隱藏帶有「人工智慧」標籤的遊戲。標籤也可能只是題材。"}
  ] as const;
  export function normalizeLevel(value: unknown): Level {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3
      ? value as Level : 1;
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
    // Scope to product tags only. Never inspect search-sidebar tag controls.
    const tagScope = scope instanceof Document ? scope.querySelector(`.glance_tags[data-appid="${id}"]`) : scope;
    const tags = Array.from(tagScope?.querySelectorAll(".app_tag") || []);
    return {
      id, title, tagMatch: parsed.ids.includes("7926") || tags.some(e => isAITag(e.textContent || "")),
      tagAvailable: raw !== null || tags.length > 0,
      disclosure: readDisclosure(scope),
      parseIssue: parsed.issue
    };
  }
  export async function getSettings(): Promise<Settings> {
    const data = await chrome.storage.local.get(["level", "allow"]);
    return {level: normalizeLevel(data.level), allow: cleanAllow(data.allow)};
  }
}
