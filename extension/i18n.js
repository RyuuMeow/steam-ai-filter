"use strict";
var SAFI18n;
(function (SAFI18n) {
    const en = {
        "app.title": "Steam AI Filter",
        "category.home": "AI filter",
        "category.settings": "Settings",
        "category.checking": "Checks & cache",
        "category.network": "Network",
        "category.display": "Display",
        "category.automation": "Automation & exceptions",
        "category.language": "Language",
        "nav.back": "Back",
        "nav.backLabel": "Go back",
        "nav.categories": "Settings categories",
        "mode.label": "AI filtering mode",
        "mode.off": "Off",
        "mode.mark": "Mark",
        "mode.mask": "Mask",
        "mode.hide": "Hide",
        "filter.title": "AI uses to filter",
        "filter.art": "Art",
        "filter.music": "Music / sound effects",
        "filter.voice": "Voice acting",
        "filter.text": "Story / text",
        "filter.translation": "Translation",
        "filter.code": "Code",
        "filter.unknown": "Unspecified use",
        "filter.unknownHelp": "An AI disclosure was found, but its specific use could not be classified.",
        "label.cacheDays": "Recheck interval",
        "label.requestGap": "Request interval",
        "label.concurrency": "Maximum concurrent requests",
        "label.showChecked": "Show check icons",
        "label.hoverReveal": "Reveal on hover",
        "label.autoIgnore": "Automatically mark as not interested",
        "label.language": "Interface language",
        "language.en": "English",
        "language.zh-Hant": "繁體中文",
        "language.zh-Hans": "简体中文",
        "option.cacheDefault": "Default: disclosure 7 days, no disclosure 1 day",
        "option.days": "{count} days",
        "option.day": "1 day",
        "option.seconds": "{count} seconds",
        "option.second": "1 second",
        "option.default": "{value} (default)",
        "action.clearCache": "Clear lookup cache",
        "action.remove": "Remove",
        "action.close": "Close",
        "action.allow": "Always show this game",
        "action.disallow": "Stop always showing",
        "action.removeAllow": "Remove the always-show exception for {title}",
        "allow.title": "Always show",
        "allow.suffix": " · Always show",
        "cache.cleared": "Lookup cache cleared.",
        "cache.clearFailed": "Could not clear the cache. Please try again.",
        "error.save": "Could not save settings. Please try again.",
        "error.contentSettings": "Could not read or save settings. Refresh the page and try again.",
        "error.stopped": "Filtering stopped. Refresh the page.",
        "error.refresh": "Refresh the Steam page to apply filtering.",
        "error.disconnected": "Page connection lost. Refresh the page.",
        "checked.checked": "Checked",
        "checked.matched": "Matched",
        "checked.help": "Green: checked, no selected use matched. Amber: a selected use matched. This does not prove whether AI was used.",
        "checked.unmatchedTitle": "Checked; no selected use matched. This does not prove that no AI was used.",
        "checked.matchedTitle": "Checked; a selected AI use matched.",
        "mask.label": "AI-generated content",
        "mask.aria": "{title} is masked. Show game",
        "mask.reveal": "Unmask",
        "mask.restore": "Mask again",
        "mask.allow": "Allow this game",
        "mask.ignore": "Not interested",
        "mask.ignorePending": "Ignoring…",
        "mask.ignoreDone": "Ignored",
        "mask.actionFailed": "Action failed. Please try again.",
        "matches.title": "Hidden games & exceptions",
        "status.mainMatched": "This game matches a selected AI use",
        "disclosure.view": "View AI disclosure",
        "disclosure.badgeAria": "AI: {uses}. View disclosure",
        "disclosure.original": "Original developer disclosure:\n\n{disclosure}{tagNote}",
        "disclosure.tagNote": "\n\nAlso has the Artificial Intelligence tag; this tag may only describe the game's theme.",
        "disclosure.tagOnly": "This game's page has the Artificial Intelligence tag. It may describe the game's theme and does not prove that generative AI was used in development.",
        "reason.disclosureTag": "AI disclosure · Artificial Intelligence tag",
        "reason.disclosure": "AI disclosure",
        "reason.tag": "Artificial Intelligence tag",
        "reason.parseIssue": "Could not read page data",
        "reason.insufficient": "Insufficient page information",
        "reason.unknown": "AI disclosure · Unspecified use",
        "reason.uses": "AI uses: {uses}{unselected}",
        "reason.unselected": " · Not selected",
        "list.separator": ", ",
        "automation.warning": "In Mask or Hide mode, adds matching games to the current Steam account's ignore list. Turning this off does not undo completed actions.",
        "automation.disabledMode": "Automatic ignoring is paused with filtering.",
        "automation.cooldown": "Steam rate limit. Retry after {time}.",
        "automation.wait": "Please wait until {time} before the next action.",
        "automation.queue": "Pending: {pending} · Confirmed ignored: {done}{last}",
        "automation.enableFailed": "Could not enable automatic ignoring.",
        "automation.stopped": "Automatic ignoring stopped. Reopen the extension and try again.",
        "automation.loginRequired": "Sign in to Steam, then turn automatic ignoring off and on again.",
        "automation.sessionUnknown": "Could not verify the Steam session. Paused.",
        "automation.connectionEnableFailed": "Could not connect to Steam. Automatic ignoring was not enabled.",
        "automation.confirmAccount": "Turn automatic ignoring off and on again to confirm the Steam account.",
        "automation.connectionFailed": "Could not connect to Steam. Retrying later.",
        "automation.rateLimited": "Steam requested a delay. Automatic ignoring is waiting.",
        "automation.denied": "Steam denied the action. Check your login, then turn automatic ignoring off and on again.",
        "automation.unavailable": "Steam could not complete the action right now.",
        "automation.listUnreadable": "Could not read Steam's ignore list. Paused.",
        "automation.listChanged": "Steam's ignore list format changed. Paused.",
        "automation.alreadyIgnored": "Already ignored: {title}",
        "automation.ignored": "Ignored: {title}",
        "automation.localLimit": "The local ignore history is full. Automatic actions stopped.",
        "automation.accountChanged": "The Steam account changed. Turn automatic ignoring off and on again.",
        "automation.unconfirmed": "Steam has not confirmed the ignore result. Checking again later.",
        "automation.responseFailed": "Could not read Steam's response. Checking again later.",
        "automation.repeatedFailure": "Repeated actions failed. Paused. Check Steam, then turn automatic ignoring off and on again.",
        "lookup.incomplete": "Lookup did not finish",
        "lookup.unavailable": "Lookup service unavailable",
        "lookup.retryLater": "Steam requested a delay",
        "lookup.allowed": "Always-show exception enabled",
        "lookup.pageFormat": "Could not verify page format",
        "lookup.pageIncomplete": "Store page incomplete or verification required",
        "lookup.disclosureUnreadable": "Could not read disclosure section",
        "lookup.disclosureChanged": "Disclosure section format changed",
        "lookup.invalidId": "Invalid game ID",
        "lookup.cacheReadFailed": "Could not read cache",
        "lookup.disabled": "Filtering is off",
        "lookup.rateLimited": "Steam temporarily limited lookups",
        "lookup.queued": "Lookup queued",
        "lookup.cancelled": "Lookup cancelled",
        "lookup.httpFailed": "Could not load store page ({status})",
        "lookup.accessFailed": "Verification required, connection timed out, or page temporarily unavailable",
        "lookup.cacheWriteFailed": "Could not save result to cache"
    };
    const hant = {
        "app.title": "Steam AI Filter",
        "category.home": "AI 過濾", "category.settings": "設定", "category.checking": "檢查與快取",
        "category.network": "網路設定", "category.display": "顯示設定", "category.automation": "自動化與例外", "category.language": "語言",
        "nav.back": "返回", "nav.backLabel": "返回上一層", "nav.categories": "設定分類",
        "mode.label": "AI 處理模式", "mode.off": "關閉", "mode.mark": "標記", "mode.mask": "遮蔽", "mode.hide": "隱藏",
        "filter.title": "過濾項目", "filter.art": "美術", "filter.music": "音樂／音效", "filter.voice": "配音", "filter.text": "劇情／文字",
        "filter.translation": "翻譯", "filter.code": "程式碼", "filter.unknown": "用途不明", "filter.unknownHelp": "已取得 AI 揭露，但無法判定具體用途。",
        "label.cacheDays": "重新檢查間隔", "label.requestGap": "請求間隔", "label.concurrency": "最大並行數", "label.showChecked": "顯示已檢查圖示", "label.hoverReveal": "滑鼠移入時解除遮蔽",
        "label.autoIgnore": "自動不感興趣", "label.language": "介面語言",
        "language.en": "English", "language.zh-Hant": "繁體中文", "language.zh-Hans": "简体中文",
        "option.cacheDefault": "預設：有揭露 7 天，無揭露 1 天", "option.days": "{count} 天", "option.day": "1 天",
        "option.seconds": "{count} 秒", "option.second": "1 秒", "option.default": "{value}（預設）",
        "action.clearCache": "清除查詢快取", "action.remove": "移除", "action.close": "關閉", "action.allow": "永遠顯示這款遊戲", "action.disallow": "取消永遠顯示",
        "action.removeAllow": "移除 {title} 的永遠顯示設定", "allow.title": "永遠顯示", "allow.suffix": " · 永遠顯示",
        "cache.cleared": "查詢快取已清除。", "cache.clearFailed": "清除失敗，請再試一次。", "error.save": "設定未能儲存，請再試一次。",
        "error.contentSettings": "設定讀取或儲存失敗，請重新整理後再試。", "error.stopped": "過濾已停止，請重新整理頁面。",
        "error.refresh": "重新整理 Steam 頁面以套用過濾。", "error.disconnected": "頁面連線已中斷，請重新整理。",
        "checked.checked": "已檢查", "checked.matched": "已命中",
        "checked.help": "綠色表示已檢查、未命中所選用途；黃色表示命中所選用途。這不代表是否使用 AI。",
        "checked.unmatchedTitle": "已檢查，未命中所選用途；不代表沒有使用 AI。", "checked.matchedTitle": "已檢查，命中所選 AI 用途。",
        "mask.label": "AI生成內容", "mask.aria": "已遮蔽 {title}。點擊顯示",
        "mask.reveal": "解除遮蔽", "mask.restore": "恢復遮蔽", "mask.allow": "允許此遊戲", "mask.ignore": "不感興趣", "mask.ignorePending": "處理中…", "mask.ignoreDone": "已忽略", "mask.actionFailed": "操作失敗，請再試一次。",
        "matches.title": "已隱藏遊戲與例外", "status.mainMatched": "這款遊戲符合所選 AI 用途", "disclosure.view": "查看 AI 使用揭露",
        "disclosure.badgeAria": "AI：{uses}。查看揭露", "disclosure.original": "開發者揭露原文：\n\n{disclosure}{tagNote}",
        "disclosure.tagNote": "\n\n亦命中「人工智慧」標籤；標籤可能只代表遊戲題材。",
        "disclosure.tagOnly": "此遊戲的頁面資料帶有「人工智慧 / Artificial Intelligence」標籤。這可能描述遊戲題材，不能證明使用生成式 AI 製作。",
        "reason.disclosureTag": "AI 使用揭露 · 人工智慧標籤", "reason.disclosure": "AI 使用揭露", "reason.tag": "人工智慧標籤",
        "reason.parseIssue": "資料讀取異常", "reason.insufficient": "本頁資訊不足", "reason.unknown": "AI 使用揭露 · 用途不明",
        "reason.uses": "AI 用途：{uses}{unselected}", "reason.unselected": " · 未選取", "list.separator": "、",
        "automation.warning": "在遮蔽或隱藏模式下，將命中遊戲加入目前 Steam 帳號的忽略清單。關閉不會撤回已完成的操作。",
        "automation.disabledMode": "自動不感興趣已隨過濾暫停。", "automation.cooldown": "Steam 限流，{time} 後重試。", "automation.wait": "請於 {time} 後再操作。",
        "automation.queue": "待忽略 {pending} 款 · 已確認忽略 {done} 款{last}", "automation.enableFailed": "無法開啟自動不感興趣。",
        "automation.stopped": "自動不感興趣已停止，請重新開啟插件再試。", "automation.loginRequired": "請先登入 Steam，再關閉並開啟自動不感興趣。",
        "automation.sessionUnknown": "無法確認 Steam 登入狀態，已暫停。", "automation.connectionEnableFailed": "無法連線至 Steam，設定未開啟。",
        "automation.confirmAccount": "請關閉再開啟自動不感興趣，以確認 Steam 帳號。", "automation.connectionFailed": "Steam 連線失敗，稍後重試。",
        "automation.rateLimited": "Steam 要求稍後重試，自動不感興趣已暫停等待。", "automation.denied": "Steam 拒絕操作；請確認登入狀態後關閉再開啟。",
        "automation.unavailable": "Steam 暫時無法完成操作。", "automation.listUnreadable": "無法讀取 Steam 忽略清單，已暫停。",
        "automation.listChanged": "Steam 忽略清單格式已變更，已暫停。", "automation.alreadyIgnored": "已在忽略清單：{title}", "automation.ignored": "已忽略：{title}",
        "automation.localLimit": "本機忽略紀錄已達上限，已停止自動操作。", "automation.accountChanged": "Steam 帳號已變更；請關閉再開啟自動不感興趣。",
        "automation.unconfirmed": "Steam 尚未確認忽略結果，稍後重新確認。", "automation.responseFailed": "Steam 回應讀取失敗，稍後重新確認。",
        "automation.repeatedFailure": "連續操作失敗，已暫停。請確認 Steam 後關閉再開啟。",
        "lookup.incomplete": "查詢未完成", "lookup.unavailable": "查詢服務無法使用", "lookup.retryLater": "Steam 要求稍後重試", "lookup.allowed": "已設為永遠顯示",
        "lookup.pageFormat": "頁面格式無法確認", "lookup.pageIncomplete": "商品頁不完整或需要驗證", "lookup.disclosureUnreadable": "揭露區塊格式無法讀取",
        "lookup.disclosureChanged": "揭露區塊格式已變更", "lookup.invalidId": "無效遊戲 ID", "lookup.cacheReadFailed": "快取讀取失敗", "lookup.disabled": "過濾已關閉",
        "lookup.rateLimited": "Steam 暫時限制查詢", "lookup.queued": "查詢排隊中", "lookup.cancelled": "查詢已取消", "lookup.httpFailed": "商品頁讀取失敗（{status}）",
        "lookup.accessFailed": "頁面需要驗證、連線逾時或暫時無法存取", "lookup.cacheWriteFailed": "結果未能寫入快取"
    };
    const hans = {
        "app.title": "Steam AI Filter",
        "category.home": "AI 过滤", "category.settings": "设置", "category.checking": "检查与缓存",
        "category.network": "网络设置", "category.display": "显示设置", "category.automation": "自动化与例外", "category.language": "语言",
        "nav.back": "返回", "nav.backLabel": "返回上一级", "nav.categories": "设置分类",
        "mode.label": "AI 处理模式", "mode.off": "关闭", "mode.mark": "标记", "mode.mask": "遮罩", "mode.hide": "隐藏",
        "filter.title": "过滤项目", "filter.art": "美术", "filter.music": "音乐／音效", "filter.voice": "配音", "filter.text": "剧情／文本",
        "filter.translation": "翻译", "filter.code": "代码", "filter.unknown": "用途不明", "filter.unknownHelp": "已获取 AI 披露，但无法判断具体用途。",
        "label.cacheDays": "重新检查间隔", "label.requestGap": "请求间隔", "label.concurrency": "最大并发数", "label.showChecked": "显示已检查图标", "label.hoverReveal": "鼠标悬停时解除遮罩",
        "label.autoIgnore": "自动标为不感兴趣", "label.language": "界面语言",
        "language.en": "English", "language.zh-Hant": "繁體中文", "language.zh-Hans": "简体中文",
        "option.cacheDefault": "默认：有披露 7 天，无披露 1 天", "option.days": "{count} 天", "option.day": "1 天",
        "option.seconds": "{count} 秒", "option.second": "1 秒", "option.default": "{value}（默认）",
        "action.clearCache": "清除查询缓存", "action.remove": "移除", "action.close": "关闭", "action.allow": "始终显示这款游戏", "action.disallow": "取消始终显示",
        "action.removeAllow": "移除 {title} 的始终显示设置", "allow.title": "始终显示", "allow.suffix": " · 始终显示",
        "cache.cleared": "查询缓存已清除。", "cache.clearFailed": "清除失败，请重试。", "error.save": "设置未能保存，请重试。",
        "error.contentSettings": "设置读取或保存失败，请刷新后重试。", "error.stopped": "过滤已停止，请刷新页面。",
        "error.refresh": "刷新 Steam 页面以应用过滤。", "error.disconnected": "页面连接已断开，请刷新。",
        "checked.checked": "已检查", "checked.matched": "已匹配",
        "checked.help": "绿色表示已检查、未匹配所选用途；黄色表示匹配所选用途。这不代表是否使用 AI。",
        "checked.unmatchedTitle": "已检查，未匹配所选用途；不代表没有使用 AI。", "checked.matchedTitle": "已检查，匹配所选 AI 用途。",
        "mask.label": "AI生成内容", "mask.aria": "已遮罩 {title}。点击显示",
        "mask.reveal": "解除遮罩", "mask.restore": "恢复遮罩", "mask.allow": "允许此游戏", "mask.ignore": "不感兴趣", "mask.ignorePending": "处理中…", "mask.ignoreDone": "已忽略", "mask.actionFailed": "操作失败，请重试。",
        "matches.title": "已隐藏游戏与例外", "status.mainMatched": "这款游戏匹配所选 AI 用途", "disclosure.view": "查看 AI 使用披露",
        "disclosure.badgeAria": "AI：{uses}。查看披露", "disclosure.original": "开发者披露原文：\n\n{disclosure}{tagNote}",
        "disclosure.tagNote": "\n\n另有“人工智能”标签；该标签可能仅表示游戏题材。",
        "disclosure.tagOnly": "此游戏的页面数据带有“人工智能 / Artificial Intelligence”标签。它可能描述游戏题材，不能证明使用生成式 AI 制作。",
        "reason.disclosureTag": "AI 使用披露 · 人工智能标签", "reason.disclosure": "AI 使用披露", "reason.tag": "人工智能标签",
        "reason.parseIssue": "数据读取异常", "reason.insufficient": "本页信息不足", "reason.unknown": "AI 使用披露 · 用途不明",
        "reason.uses": "AI 用途：{uses}{unselected}", "reason.unselected": " · 未选择", "list.separator": "、",
        "automation.warning": "在遮罩或隐藏模式下，将匹配游戏加入当前 Steam 账号的忽略列表。关闭不会撤销已完成的操作。",
        "automation.disabledMode": "自动不感兴趣已随过滤暂停。", "automation.cooldown": "Steam 限流，{time} 后重试。", "automation.wait": "请于 {time} 后再操作。",
        "automation.queue": "待忽略 {pending} 款 · 已确认忽略 {done} 款{last}", "automation.enableFailed": "无法开启自动不感兴趣。",
        "automation.stopped": "自动不感兴趣已停止，请重新打开扩展后重试。", "automation.loginRequired": "请先登录 Steam，再关闭并开启自动不感兴趣。",
        "automation.sessionUnknown": "无法确认 Steam 登录状态，已暂停。", "automation.connectionEnableFailed": "无法连接 Steam，设置未开启。",
        "automation.confirmAccount": "请关闭再开启自动不感兴趣，以确认 Steam 账号。", "automation.connectionFailed": "Steam 连接失败，稍后重试。",
        "automation.rateLimited": "Steam 要求稍后重试，自动不感兴趣已暂停等待。", "automation.denied": "Steam 拒绝操作；请确认登录状态后关闭再开启。",
        "automation.unavailable": "Steam 暂时无法完成操作。", "automation.listUnreadable": "无法读取 Steam 忽略列表，已暂停。",
        "automation.listChanged": "Steam 忽略列表格式已更改，已暂停。", "automation.alreadyIgnored": "已在忽略列表：{title}", "automation.ignored": "已忽略：{title}",
        "automation.localLimit": "本地忽略记录已达上限，已停止自动操作。", "automation.accountChanged": "Steam 账号已更改；请关闭再开启自动不感兴趣。",
        "automation.unconfirmed": "Steam 尚未确认忽略结果，稍后重新确认。", "automation.responseFailed": "Steam 响应读取失败，稍后重新确认。",
        "automation.repeatedFailure": "连续操作失败，已暂停。请确认 Steam 后关闭再开启。",
        "lookup.incomplete": "查询未完成", "lookup.unavailable": "查询服务不可用", "lookup.retryLater": "Steam 要求稍后重试", "lookup.allowed": "已设为始终显示",
        "lookup.pageFormat": "无法确认页面格式", "lookup.pageIncomplete": "商店页面不完整或需要验证", "lookup.disclosureUnreadable": "无法读取披露区块格式",
        "lookup.disclosureChanged": "披露区块格式已更改", "lookup.invalidId": "无效游戏 ID", "lookup.cacheReadFailed": "缓存读取失败", "lookup.disabled": "过滤已关闭",
        "lookup.rateLimited": "Steam 暂时限制查询", "lookup.queued": "查询排队中", "lookup.cancelled": "查询已取消", "lookup.httpFailed": "商店页面读取失败（{status}）",
        "lookup.accessFailed": "页面需要验证、连接超时或暂时无法访问", "lookup.cacheWriteFailed": "结果未能写入缓存"
    };
    SAFI18n.messages = { en, "zh-Hant": hant, "zh-Hans": hans };
    function detect(value) {
        if (typeof value !== "string" || !value.trim())
            return undefined;
        const tag = value.trim().replace(/_/g, "-").toLowerCase();
        if (/^zh(?:-|$)/.test(tag))
            return /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag) ? "zh-Hant" : "zh-Hans";
        return "en";
    }
    function normalizeLanguage(value) {
        const explicit = detect(value);
        if (explicit)
            return explicit;
        // Both browser contexts and the service worker can use this file.
        try {
            if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
                const browser = detect(chrome.i18n.getUILanguage());
                if (browser)
                    return browser;
            }
        }
        catch { /* Fall back to navigator when the extension context is unavailable. */ }
        return detect(typeof navigator === "undefined" ? undefined : navigator.language) || "en";
    }
    SAFI18n.normalizeLanguage = normalizeLanguage;
    let language = normalizeLanguage(undefined);
    function setLanguage(value) { language = normalizeLanguage(value); }
    SAFI18n.setLanguage = setLanguage;
    function t(key, params = {}) {
        return SAFI18n.messages[language][key].replace(/\{([a-zA-Z]+)\}/g, (placeholder, name) => Object.hasOwn(params, name) ? String(params[name]) : placeholder);
    }
    SAFI18n.t = t;
    // Stored automation notices may have been written in another interface language.
    // Match known templates only; game titles and Steam disclosure text stay intact.
    function localizeStored(text) {
        const keys = Object.keys(en).filter(key => key.startsWith("automation.") || key.startsWith("lookup.") || key.startsWith("error.") || key === "mask.actionFailed");
        for (const dictionary of Object.values(SAFI18n.messages)) {
            for (const key of keys) {
                const template = dictionary[key];
                if (template === text)
                    return t(key);
                if (!template.includes("{"))
                    continue;
                const names = [];
                const pattern = template.split(/(\{[a-zA-Z]+\})/).map(part => {
                    if (/^\{[a-zA-Z]+\}$/.test(part)) {
                        names.push(part.slice(1, -1));
                        return "([\\s\\S]*?)";
                    }
                    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                }).join("");
                const match = new RegExp(`^${pattern}$`).exec(text);
                if (match)
                    return t(key, Object.fromEntries(names.map((name, index) => [name, match[index + 1]])));
            }
        }
        return text;
    }
    SAFI18n.localizeStored = localizeStored;
})(SAFI18n || (SAFI18n = {}));
