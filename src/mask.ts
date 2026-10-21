namespace SAF {
  interface Original { label: string | null; role: string | null; tab: string | null; children: Map<HTMLElement, {inert: boolean; aria: string | null}> }
  const originals = new WeakMap<Element, Original>();
  export function syncMask(card: Element, evidence: Evidence | null, presentation: Presentation = "mask"): void {
    const mask = card.querySelector<HTMLElement>(":scope > .saf-mask");
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
          if (state.aria === null) child.removeAttribute("aria-hidden"); else child.setAttribute("aria-hidden", state.aria);
        }
        for (const [name, value] of [["aria-label", original.label], ["role", original.role], ["tabindex", original.tab]]) {
          if (value === null) card.removeAttribute(name!); else card.setAttribute(name!, value!);
        }
        originals.delete(card);
      }
      if (removed) for (const media of card.querySelectorAll<HTMLMediaElement>("video, audio")) media.pause();
      return;
    }
    let original = originals.get(card);
    if (!original) {
      original = {label: card.getAttribute("aria-label"), role: card.getAttribute("role"), tab: card.getAttribute("tabindex"), children: new Map()};
      originals.set(card, original);
      if (getComputedStyle(card).position === "static") card.classList.add("saf-positioned");
    }
    card.classList.add("saf-blocked");
    const title = "已遮蔽";
    card.setAttribute("aria-label", `已遮蔽 ${evidence.title}。點擊查看原因`);
    card.setAttribute("role", "button");
    if (!card.matches("a[href]")) card.setAttribute("tabindex", "0");
    let cover = mask;
    if (!cover) {
      cover = document.createElement("span"); cover.className = "saf-mask"; cover.setAttribute("aria-hidden", "true");
      // Fixed, locally authored SVG; no site content is interpolated.
      cover.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2C16 3.5 21 12 21 12a18 18 0 0 1-3 3.7M6.2 6.2A21 21 0 0 0 3 12s5 8 11.3 6.4"/></svg><span class="saf-mask-label"></span>';
      card.append(cover);
    }
    const label = cover.querySelector(".saf-mask-label")!;
    if (label.textContent !== title) label.textContent = title;
    for (const child of Array.from(card.children)) {
      if (!(child instanceof HTMLElement) || child === cover || child.classList.contains("saf-checked")) continue;
      if (!original.children.has(child)) original.children.set(child, {inert: child.inert, aria: child.getAttribute("aria-hidden")});
      child.inert = true; child.setAttribute("aria-hidden", "true");
    }
    for (const media of card.querySelectorAll<HTMLMediaElement>("video, audio")) media.pause();
  }
}
