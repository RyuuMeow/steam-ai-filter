"use strict";
var SAFDisclosure;
(function (SAFDisclosure) {
    const memo = new Map();
    function denied(clause) {
        // "Not only" explicitly includes a use; do not mistake it for a denial.
        const text = clause.replace(/\bnot (?:only|just)\b|不僅|不仅|不只/gu, "");
        if (/\b(?:no|not|never|without|isn't|aren't|wasn't|weren't|don't|doesn't|didn't)\b|沒有|没有|未使用|不使用|並未|并未|不是|非\s*ai|無\s*ai|无\s*ai/u.test(text))
            return true;
        if (/\b(?:ai[- ]generated|(?:generated|created) (?:by|with|using) ai)\b|ai\s*生成/u.test(text))
            return false;
        return /\b(?:hand[ -]?(?:drawn|made|crafted|written)|human[ -](?:made|created|written)|(?:created|made|written|drawn) (?:entirely |solely )?by humans)\b|手繪|手绘|手工製作|手工制作|人工(?:製作|制作|撰寫|编写)/u.test(text);
    }
    function splitCoordination(clause) {
        const parts = [];
        let start = 0;
        for (const join of clause.matchAll(/\s+and\s+|[,，]\s*/gu)) {
            const before = clause.slice(start, join.index), after = clause.slice(join.index + join[0].length);
            const newSubject = /^(?:not|no|all|we|ai|our|the)\b|^(?:沒有|没有)/u.test(after);
            const newAction = /^\s+and/u.test(join[0]) && /^(?:generat|creat|writ|translat|locali[sz])\w*\b/u.test(after);
            const newPredicate = /\b(?:is|are|was|were)\b/u.test(before)
                && /^[^,.;]{1,40}\b(?:is|are|was|were)\b/u.test(after);
            if (newSubject || newAction || newPredicate) {
                parts.push(before);
                start = join.index + join[0].length;
            }
        }
        parts.push(clause.slice(start));
        return parts;
    }
    function classify(raw) {
        const text = raw.normalize("NFKC").toLowerCase()
            .replace(/^ai[- ]generated content disclosure\s*:?\s*/u, "")
            .replaceAll("’", "'");
        // Keep enumerated lists together, but separate a new subject/predicate or denial.
        const clauses = text.split(/[.!?;\n。；！？]+|\b(?:but|however|whereas|while|except)\b|但是|然而|但|除了|(?:且|而|並且|并且)(?=.{0,20}(?:ai|生成|手繪|手绘))/u).flatMap(splitCoordination);
        const found = new Set();
        for (const clause of clauses) {
            if (denied(clause))
                continue;
            // Translated dialogue/text is translation, not generated narrative.
            // Remove only the translation's object, leaving separately generated text intact.
            const withoutTranslationObject = clause
                .replace(/\b(?:translat(?:e[ds]?|ing|ions?)|locali[sz](?:ation|e[ds]?|ing))\s+(?:(?:of|the|our|in[ -]game|game|existing|original|written|all|some)\s+)*(?:dialogue|dialog|text|stories|story|narrative|writing|copywriting|written content)\b(?:\s*(?:,|and|or)\s*(?:dialogue|dialog|text|stories|story|narrative)\b)*/gu, "")
                .replace(/\b(?:dialogue|dialog|text|stories|story|narrative)\s+(?:translat(?:e[ds]?|ing|ions?)|locali[sz]ation)\b/gu, "")
                .replace(/(?:翻譯|翻译|本地化|在地化)(?:遊戲|游戏|原有|原本|所有|的)*(?:對話|对话|台詞|台词|劇情|剧情|故事|文字|文本)|(?:對話|对话|台詞|台词|劇情|剧情|故事|文字|文本)(?:的)?(?:翻譯|翻译|本地化|在地化)/gu, "")
                .replace(/\bwriting\s+(?:(?:the|our|game|some|source)\s+)*(?:code|unit tests|shaders)\b/gu, "")
                .replace(/\btext[ -]to[ -]speech\b/gu, "");
            for (const category of SAFDisclosure.categories) {
                if (SAFDisclosure.packs[category].pattern.test(category === "text" ? withoutTranslationObject : clause))
                    found.add(category);
            }
        }
        return Object.freeze(SAFDisclosure.categories.filter(category => found.has(category)));
    }
    function classifyUses(disclosure) {
        if (!disclosure)
            return [];
        const cached = memo.get(disclosure);
        if (cached)
            return cached;
        const result = classify(disclosure);
        if (memo.size >= 500)
            memo.delete(memo.keys().next().value);
        memo.set(disclosure, result);
        return result;
    }
    SAFDisclosure.classifyUses = classifyUses;
})(SAFDisclosure || (SAFDisclosure = {}));
