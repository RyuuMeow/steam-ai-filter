"use strict";
var SAFDisclosure;
(function (SAFDisclosure) {
    const memo = new Map();
    function excludesGeneratedContent(clause) {
        for (const pattern of [SAFDisclosure.keywords.noContent, SAFDisclosure.keywords.humanContent, SAFDisclosure.keywords.noContentChinese, SAFDisclosure.keywords.humanContentChinese]) {
            const list = clause.match(pattern)?.[1];
            if (list && SAFDisclosure.keywords.nonCode.test(list) && !list.replace(SAFDisclosure.keywords.contentList, "").trim())
                return true;
        }
        return false;
    }
    function classify(raw) {
        // A truncated disclosure cannot establish exclusivity.
        if (!raw || raw.length >= 2000)
            return false;
        const text = raw.normalize("NFKC").toLowerCase()
            .replace(/^ai[- ]generated content disclosure\s*:?\s*/u, "").trim();
        const clauses = text.split(/[.!?;\n。；！？]+|[,，]\s*(?=(?:but|however|yet|although|except)\b|但是|但|然而)|\b(?:but|however|yet|although)\b|但是|然而/u)
            .map(clause => clause.trim().replace(/^[-:：]\s*/u, "")).filter(Boolean);
        let explicitCode = false;
        for (const clause of clauses) {
            if (SAFDisclosure.keywords.uncertain.test(clause) || SAFDisclosure.keywords.live.test(clause) ||
                SAFDisclosure.keywords.codeDenied.test(clause) || SAFDisclosure.keywords.humanCode.test(clause))
                return false;
            if (SAFDisclosure.keywords.nonCode.test(clause)) {
                // Never erase a mixed code/content clause as a blanket "human made" claim.
                if (SAFDisclosure.keywords.code.test(clause) || /\b(?:and|with)\s+(?:ai|generative)|(?:以及|並且|并且).*ai/u.test(clause))
                    return false;
                if (excludesGeneratedContent(clause))
                    continue;
                return false;
            }
            // Unrecognised sentences stay filtered; absence of an art keyword is not proof.
            if (!SAFDisclosure.keywords.code.test(clause))
                return false;
            if (SAFDisclosure.keywords.exclusive.test(clause))
                explicitCode = true;
        }
        return explicitCode;
    }
    function isCodeOnly(disclosure) {
        if (!disclosure)
            return false;
        const cached = memo.get(disclosure);
        if (cached !== undefined)
            return cached;
        const result = classify(disclosure);
        if (memo.size >= 500)
            memo.delete(memo.keys().next().value);
        memo.set(disclosure, result);
        return result;
    }
    SAFDisclosure.isCodeOnly = isCodeOnly;
})(SAFDisclosure || (SAFDisclosure = {}));
