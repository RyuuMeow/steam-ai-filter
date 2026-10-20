namespace SAF {
  interface Original { label: string | null; role: string | null; children: Map<HTMLElement, {inert: boolean; aria: string | null}> }
  const originals = new WeakMap<Element, Original>();
  export function syncMask(card: Element, evidence: Evidence | null): void {
    const mask = card.querySelector<HTMLElement>(":scope > .saf-mask");
    if (!evidence) {
      mask?.remove();
      card.classList.remove("saf-blocked", "saf-positioned");
      const original = originals.get(card);
      if (original) {
        for (const [child, state] of original.children) {
          child.inert = state.inert;
          if (state.aria === null) child.removeAttribute("aria-hidden"); else child.setAttribute("aria-hidden", state.aria);
        }
        for (const [name, value] of [["aria-label", original.label], ["role", original.role]]) {
          if (value === null) card.removeAttribute(name!); else card.setAttribute(name!, value!);
        }
        originals.delete(card);
      }
      return;
    }
    let original = originals.get(card);
    if (!original) {
      original = {label: card.getAttribute("aria-label"), role: card.getAttribute("role"), children: new Map()};
      originals.set(card, original);
      if (getComputedStyle(card).position === "static") card.classList.add("saf-positioned");
    }
    card.classList.add("saf-blocked");
    const title = evidence.disclosure ? "AI 生成內容" : "人工智慧標籤";
    card.setAttribute("aria-label", `${title}，已遮蔽 ${evidence.title}。點擊查看原因`);
    card.setAttribute("role", "button");
    let cover = mask;
    if (!cover) {
      cover = document.createElement("span"); cover.className = "saf-mask"; cover.setAttribute("aria-hidden", "true");
      // Fixed, locally authored SVG; no site content is interpolated.
      cover.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg><span class="saf-mask-label"></span>';
      card.append(cover);
    }
    const label = cover.querySelector(".saf-mask-label")!;
    if (label.textContent !== title) label.textContent = title;
    for (const child of Array.from(card.children)) {
      if (!(child instanceof HTMLElement) || child === cover) continue;
      if (!original.children.has(child)) original.children.set(child, {inert: child.inert, aria: child.getAttribute("aria-hidden")});
      child.inert = true; child.setAttribute("aria-hidden", "true");
    }
    for (const media of card.querySelectorAll<HTMLMediaElement>("video, audio")) media.pause();
  }
}
