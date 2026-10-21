"use strict";
var SAF;
(function (SAF) {
    const originals = new WeakMap();
    function syncMask(card, evidence, presentation = "mask", actions) {
        const mask = card.querySelector(":scope > .saf-mask");
        const removed = Boolean(evidence && presentation === "remove");
        // Keep Steam's DOM ownership intact so changing modes, recycled cards and recovery all work.
        card.classList.toggle("saf-removed", removed);
        if (!evidence || removed) {
            mask?.remove();
            card.classList.remove("saf-blocked", "saf-positioned");
            const original = originals.get(card);
            if (original) {
                for (const [child, state] of original.children) {
                    child.inert = state.inert;
                    if (state.aria === null)
                        child.removeAttribute("aria-hidden");
                    else
                        child.setAttribute("aria-hidden", state.aria);
                }
                for (const [name, value] of [["aria-label", original.label], ["role", original.role], ["tabindex", original.tab]]) {
                    if (value === null)
                        card.removeAttribute(name);
                    else
                        card.setAttribute(name, value);
                }
                originals.delete(card);
            }
            if (removed)
                for (const media of card.querySelectorAll("video, audio"))
                    media.pause();
            return;
        }
        let original = originals.get(card);
        if (!original) {
            original = { label: card.getAttribute("aria-label"), role: card.getAttribute("role"), tab: card.getAttribute("tabindex"), children: new Map() };
            originals.set(card, original);
        }
        // A revealed card may still be positioned by its eye/check badge. Take over
        // that containing block before render removes the badge's positioning class.
        if (card.classList.contains("saf-badge-positioned") || getComputedStyle(card).position === "static")
            card.classList.add("saf-positioned");
        card.classList.add("saf-blocked");
        const title = SAFI18n.t("mask.label");
        card.setAttribute("aria-label", SAFI18n.t("mask.aria", { title: evidence.title }));
        card.setAttribute("role", "group");
        if (!card.matches("a[href]"))
            card.setAttribute("tabindex", "0");
        let cover = mask;
        if (!cover) {
            cover = document.createElement("span");
            cover.className = "saf-mask";
            cover.innerHTML = '<span class="saf-mask-label" aria-hidden="true"></span><span class="saf-mask-actions"><button type="button" data-action="reveal"></button><button type="button" data-action="allow"></button><button type="button" data-action="ignore"></button></span><span class="saf-mask-status" role="status" hidden></span>';
            card.append(cover);
        }
        const label = cover.querySelector(".saf-mask-label");
        if (label.textContent !== title)
            label.textContent = title;
        if (actions) {
            cover.classList.toggle("saf-mask-busy", Boolean(actions.pending || actions.issue));
            for (const name of ["reveal", "allow", "ignore"]) {
                const button = cover.querySelector(`[data-action="${name}"]`);
                const key = name === "ignore" && actions.ignored ? "mask.ignoreDone" : name === actions.pending ? "mask.ignorePending" : `mask.${name}`;
                button.textContent = SAFI18n.t(key);
                button.disabled = Boolean(actions.pending || (name === "ignore" && actions.ignored));
                button.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (name === "ignore" && !event.isTrusted)
                        return;
                    actions[name]();
                };
            }
            const status = cover.querySelector(".saf-mask-status");
            status.hidden = !actions.issue;
            status.textContent = actions.issue ? SAFI18n.localizeStored(actions.issue) : "";
        }
        for (const child of Array.from(card.children)) {
            if (!(child instanceof HTMLElement) || child === cover)
                continue;
            if (!original.children.has(child))
                original.children.set(child, { inert: child.inert, aria: child.getAttribute("aria-hidden") });
            child.inert = true;
            child.setAttribute("aria-hidden", "true");
        }
        for (const media of card.querySelectorAll("video, audio"))
            media.pause();
    }
    SAF.syncMask = syncMask;
})(SAF || (SAF = {}));
