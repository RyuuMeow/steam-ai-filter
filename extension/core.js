"use strict";
var SAF;
(function (SAF) {
    SAF.filterCategories = [...SAFDisclosure.categories, "unknown"];
    SAF.categoryLabel = (category) => SAFI18n.t(`filter.${category}`);
    SAF.settingKeys = ["mode", "level", "presentation", "filterCategories", "autoIgnore", "showChecked", "hoverReveal", "allow", "requestGap", "concurrency", "cacheDays", "language"];
    SAF.modes = [
        { id: "off" }, { id: "mark" }, { id: "mask" }, { id: "hide" }
    ];
    function normalizeMode(value) {
        return SAF.modes.find(mode => mode.id === value)?.id || "mask";
    }
    SAF.normalizeMode = normalizeMode;
    function presentation(mode) {
        return mode === "hide" ? "remove" : "mask";
    }
    SAF.presentation = presentation;
    function filters(mode) { return mode === "mask" || mode === "hide"; }
    SAF.filters = filters;
    function normalizeSettings(data = {}) {
        // A separate key prevents old broad=3 from silently becoming the new hide mode.
        const legacyMode = data.level === 0 ? "off" : data.level === 1 ? "mark" : data.presentation === "remove" ? "hide" : "mask";
        return { mode: data.mode === undefined ? legacyMode : normalizeMode(data.mode),
            filterCategories: normalizeCategories(data.filterCategories), autoIgnore: data.autoIgnore === true,
            showChecked: data.showChecked !== false, hoverReveal: data.hoverReveal === true, allow: cleanAllow(data.allow), language: SAFI18n.normalizeLanguage(data.language),
            requestGap: [700, 1000, 2000, 5000].includes(data.requestGap) ? data.requestGap : 700,
            concurrency: [1, 2, 3, 4].includes(data.concurrency) ? data.concurrency : 2,
            cacheDays: data.cacheDays === 1 || data.cacheDays === 7 || data.cacheDays === 30 ? data.cacheDays : 0 };
    }
    SAF.normalizeSettings = normalizeSettings;
    function normalizeCategories(value) {
        const saved = value && typeof value === "object" && !Array.isArray(value) ? value : null;
        return Object.fromEntries(SAF.filterCategories.map(category => [category, saved ? saved[category] === true : category === "art"]));
    }
    SAF.normalizeCategories = normalizeCategories;
    function cleanAllow(value) {
        const result = {};
        if (value && typeof value === "object") {
            for (const [id, title] of Object.entries(value)) {
                if (/^\d+$/.test(id) && typeof title === "string")
                    result[id] = title.slice(0, 200);
            }
        }
        return result;
    }
    SAF.cleanAllow = cleanAllow;
    function normalizeText(value) {
        return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    }
    SAF.normalizeText = normalizeText;
    function isAITag(value) {
        return ["人工智慧", "人工智能", "artificial intelligence"].includes(normalizeText(value));
    }
    SAF.isAITag = isAITag;
    function isDisclosureHeading(value) {
        return [
            "ai generated content disclosure", "ai-generated content disclosure",
            "ai 生成內容聲明", "ai 生成内容声明", "ai 生成内容披露"
        ].includes(normalizeText(value));
    }
    SAF.isDisclosureHeading = isDisclosureHeading;
    function parseTagIds(raw) {
        if (raw === null)
            return { ids: [], issue: false };
        try {
            const data = JSON.parse(raw);
            if (!Array.isArray(data) || data.some(x => !/^\d+$/.test(String(x)))) {
                return { ids: [], issue: true };
            }
            return { ids: data.map(String), issue: false };
        }
        catch {
            return { ids: [], issue: true };
        }
    }
    SAF.parseTagIds = parseTagIds;
    function matchesUses(e, allow, selected = normalizeCategories()) {
        if (Object.hasOwn(allow, e.id) || !e.disclosure?.trim())
            return false;
        const uses = SAFDisclosure.classifyUses(e.disclosure);
        return uses.length ? uses.some(category => selected[category]) : selected.unknown;
    }
    SAF.matchesUses = matchesUses;
    function shouldHide(e, mode, allow, selected = normalizeCategories()) {
        return filters(mode) && matchesUses(e, allow, selected);
    }
    SAF.shouldHide = shouldHide;
    function reason(e) {
        if (e.disclosure && e.tagMatch)
            return SAFI18n.t("reason.disclosureTag");
        if (e.disclosure)
            return SAFI18n.t("reason.disclosure");
        if (e.tagMatch)
            return SAFI18n.t("reason.tag");
        return SAFI18n.t(e.parseIssue ? "reason.parseIssue" : "reason.insufficient");
    }
    SAF.reason = reason;
    function readDisclosure(scope) {
        // Steam uses the same descriptor ID for mature and AI content. Check the heading.
        for (const section of scope.querySelectorAll("#game_area_content_descriptors, .game_area_description")) {
            const heading = section.querySelector("h2");
            if (!heading || !isDisclosureHeading(heading.textContent || ""))
                continue;
            const quote = section.querySelector("i");
            const text = (quote ? quote.innerText || quote.textContent || ""
                : (section.textContent || "").replace(heading.textContent || "", "")).trim();
            if (text)
                return text;
        }
        return null;
    }
    SAF.readDisclosure = readDisclosure;
    function readEvidence(scope, id, title) {
        // A homepage recommendation's reason describes a different, previously played
        // game. Only its product gallery contributes tags/disclosure to this card.
        if (scope instanceof Element)
            scope = singleRecommendation(scope)?.gallery || scope;
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
    SAF.readEvidence = readEvidence;
    // Labels only: no store path is excluded from card discovery.
    function pageKind(path) {
        if (path === "/")
            return "home";
        if (/^\/search\/?$/.test(path))
            return "search";
        if (/^\/app\/\d+(?:\/|$)/.test(path))
            return "app";
        return "store";
    }
    SAF.pageKind = pageKind;
    function hrefId(href) {
        if (!href)
            return null;
        try {
            const url = new URL(href, location.href);
            if (url.hostname !== "store.steampowered.com" && url.origin !== location.origin)
                return null;
            return url.pathname.match(/^\/app\/([1-9]\d{0,9})(?:\/|$)/)?.[1] || null;
        }
        catch {
            return null;
        }
    }
    const ownerSelector = "a[href], [data-ds-appid], [data-appid], [data-app-id], [data-ds-itemkey]";
    const boundary = "body, html, main, [role=main], [role=list], .responsive_page_template_content, .home_page_content, .home_ctn, #search_resultsRows";
    const excluded = "#saf-root, .saf-badge, .saf-mask, #global_header, #global_action_menu, #store_header, #footer, nav, [role=navigation], [data-featuretarget=footer]";
    function directCardId(element) {
        // An explicit non-app URL (bundle, package or external) wins over incidental data.
        if (element.matches("a[href]"))
            return hrefId(element.getAttribute("href"));
        for (const name of ["data-ds-appid", "data-appid", "data-app-id"]) {
            const id = element.getAttribute(name);
            if (id && /^[1-9]\d{0,9}$/.test(id))
                return id;
        }
        return element.getAttribute("data-ds-itemkey")?.match(/^App_([1-9]\d{0,9})$/i)?.[1] || null;
    }
    function rawOwnerIds(element, ignored = null) {
        const ids = new Set();
        const own = directCardId(element);
        if (own)
            ids.add(own);
        for (const child of element.querySelectorAll(ownerSelector)) {
            if (ignored?.contains(child))
                continue;
            const id = directCardId(child);
            if (id)
                ids.add(id);
            if (ids.size > 1)
                break;
        }
        return ids;
    }
    function singleRecommendation(element) {
        if (!element.matches(".home_content.single"))
            return null;
        const galleries = element.querySelectorAll(":scope > .home_content_items");
        const headers = element.querySelectorAll(":scope > .single_header_ctn");
        if (galleries.length !== 1 || headers.length !== 1)
            return null;
        const reasons = headers[0].querySelectorAll(":scope > .single_title_ctn > .home_content_reason");
        if (reasons.length > 1)
            return null;
        const reason = reasons[0] || null;
        // Only a text reference is exempt. Extra artwork or another actual game card
        // must retain the mixed-game protection.
        if (reason?.querySelector("img, video, [style*='background-image'], [data-ds-appid], [data-appid], [data-app-id], [data-ds-itemkey]"))
            return null;
        const gallery = galleries[0], ids = rawOwnerIds(gallery);
        if (ids.size !== 1)
            return null;
        const id = [...ids][0], rest = rawOwnerIds(element, reason);
        return rest.size === 1 && rest.has(id) ? { id, gallery } : null;
    }
    function ownerIds(element) {
        const single = singleRecommendation(element);
        return single ? new Set([single.id]) : rawOwnerIds(element);
    }
    function cardId(card) {
        const ids = ownerIds(card);
        return ids.size === 1 ? [...ids][0] : null;
    }
    SAF.cardId = cardId;
    function collectCards(root, _kind) {
        const metadata = new Map();
        const info = (el) => {
            if (!metadata.has(el))
                metadata.set(el, { ids: ownerIds(el), media: el.querySelectorAll("img, video, [style*='background-image']").length });
            return metadata.get(el);
        };
        const candidates = new Set();
        for (const element of root.querySelectorAll(ownerSelector)) {
            if (element.matches(boundary) || element.closest(excluded))
                continue;
            const id = directCardId(element);
            if (!id || info(element).ids.size !== 1)
                continue;
            const media = info(element).media || (element instanceof HTMLElement && Boolean(element.style.backgroundImage) ? 1 : 0);
            const known = element.matches(".search_result_row, .store_main_capsule, .sale_capsule, .tab_row_item, .tab_item, .home_smallcap, .small_cap, .wishlist_row");
            if (!media && !known)
                continue;
            let card = element, mediaCount = media;
            // Expand to the single-game artwork group. Stop at mixed-game shelves, page
            // roots or navigation so a recommendation can never cover its neighbours.
            for (let parent = element.parentElement, depth = 0; parent && depth < 12; parent = parent.parentElement, depth++) {
                if (parent.matches(boundary) || parent.closest(excluded))
                    break;
                const details = info(parent);
                if (details.ids.size !== 1 || !details.ids.has(id))
                    break;
                if (parent.querySelector("a[href*='/bundle/'], a[href*='/sub/'], nav, [role=navigation]"))
                    break;
                const extraMedia = [...parent.querySelectorAll("img, video, [style*='background-image']")].filter(m => !card.contains(m));
                const sameGameAssets = extraMedia.length > 0 && extraMedia.every(m => {
                    const source = m.getAttribute("data-image-url") || m.getAttribute("src") || m.getAttribute("poster") || m.getAttribute("style") || "";
                    return source.match(/\/steam\/apps\/([1-9]\d{0,9})\//)?.[1] === id;
                });
                // Steam's expanded card contains trailers with separate movie IDs. The
                // explicit game-card boundary is stronger evidence than media URL equality.
                const single = singleRecommendation(parent);
                const wholeObject = Boolean(single) || parent.matches(".LibraryAssetExpandedDisplay, .carousel__slide, .trailercarousel");
                if (wholeObject || (details.media > mediaCount && sameGameAssets) || directCardId(parent) === id) {
                    card = parent;
                    mediaCount = details.media;
                }
                if (single || parent.matches(".carousel__slide, .trailercarousel"))
                    break;
            }
            candidates.add(card);
        }
        return [...candidates].filter(card => {
            for (let parent = card.parentElement; parent; parent = parent.parentElement)
                if (candidates.has(parent))
                    return false;
            return true;
        });
    }
    SAF.collectCards = collectCards;
    function removalContainer(card) {
        if (singleRecommendation(card)) {
            const wrapper = card.parentElement;
            return wrapper?.matches(".home_content_single_ctn") && wrapper.children.length === 1 ? wrapper : card;
        }
        if (!card.matches(".LibraryAssetExpandedDisplay"))
            return card;
        const row = card.closest(".SaleSectionContainer");
        // A section can also contain several games: only collapse a single expanded row.
        return row && row.querySelectorAll(".LibraryAssetExpandedDisplay").length === 1
            && !row.querySelector("nav, [role=navigation], h1, h2") && cardId(row) === cardId(card) ? row : card;
    }
    SAF.removalContainer = removalContainer;
    function cardTitle(card, id) {
        return card.querySelector(".title, .app_name, .tab_item_title, .tab_item_name, .recommendation_title, .single_title")?.textContent?.trim()
            || card.querySelector("img[alt]")?.getAttribute("alt")?.trim() || `App ${id}`;
    }
    SAF.cardTitle = cardTitle;
    function mergeEvidence(entries) {
        const all = Array.from(entries), byId = new Map();
        for (const [, e] of all) {
            const other = byId.get(e.id);
            byId.set(e.id, other ? { ...e, tagMatch: other.tagMatch || e.tagMatch,
                disclosure: other.disclosure || e.disclosure, tagAvailable: other.tagAvailable || e.tagAvailable,
                parseIssue: other.parseIssue || e.parseIssue } : e);
        }
        // Merge afresh on every render so removed signals never remain sticky.
        return new Map(all.map(([el, e]) => [el, { ...byId.get(e.id), title: e.title }]));
    }
    SAF.mergeEvidence = mergeEvidence;
    async function getSettings() {
        return normalizeSettings(await chrome.storage.local.get(SAF.settingKeys));
    }
    SAF.getSettings = getSettings;
})(SAF || (SAF = {}));
