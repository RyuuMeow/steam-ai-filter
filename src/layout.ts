namespace SAF {
  interface CompactCarousel {
    root: HTMLElement;
    viewport: HTMLElement;
    tray: HTMLElement;
    events: AbortController;
    buttons: Map<HTMLButtonElement, boolean>;
    pagination: Set<Element>;
    tabindex: string | null;
    observer: ResizeObserver;
    mutations: MutationObserver;
    update: () => void;
  }
  // Steam still owns every node. Reversible CSS removes whole slots; a native
  // scroll viewport avoids the carousel library's stale unfiltered slide indices.
  export class RemovalLayout {
    private wrappers = new Set<Element>();
    private carousels = new Map<HTMLElement, CompactCarousel>();
    sync(removed: Element[]): void {
      const wrappers = new Set<Element>();
      const active = new Map<HTMLElement, {tray: HTMLElement; viewport: HTMLElement}>();
      for (const card of removed) {
        const outer = removalContainer(card);
        if (outer !== card) wrappers.add(outer);
        const slide = card.closest<HTMLElement>(".carousel__slide");
        const tray = slide?.parentElement;
        const viewport = tray?.closest<HTMLElement>(".carousel__slider");
        const root = viewport?.closest<HTMLElement>(".carousel");
        if (root && viewport && tray?.matches(".carousel__slider-tray--horizontal")) active.set(root, {tray, viewport});
      }
      for (const el of this.wrappers) if (!wrappers.has(el)) el.classList.remove("saf-removed-wrapper");
      for (const el of wrappers) el.classList.add("saf-removed-wrapper");
      this.wrappers = wrappers;
      for (const [root, state] of this.carousels) {
        const current = active.get(root);
        if (!current || current.tray !== state.tray || current.viewport !== state.viewport) this.restore(state);
      }
      for (const [root, {tray, viewport}] of active) {
        let state = this.carousels.get(root);
        if (!state) {
          // The native inline percentages preserve Steam's responsive card width.
          if (!this.slideWidth(tray)) continue;
          const events = new AbortController();
          state = {root, tray, viewport, events, buttons: new Map(), pagination: new Set(),
            tabindex: viewport.getAttribute("tabindex"), observer: new ResizeObserver(() => state!.update()),
            mutations: new MutationObserver(records => {
              if (records.some(record => record.target === tray || (record.target as Element).parentElement === tray)) state!.update();
            }), update: () => {}};
          const current = state;
          current.update = () => {
            if (!this.carousels.has(root)) return;
            const width = this.slideWidth(tray);
            if (width && tray.style.getPropertyValue("--saf-slide-width") !== width) tray.style.setProperty("--saf-slide-width", width);
            const slides = Array.from(tray.children).filter(el => el.matches(".carousel__slide"));
            root.classList.toggle("saf-empty-carousel", slides.length > 0 && slides.every(el => el.classList.contains("saf-removed")));
            for (const button of root.querySelectorAll<HTMLButtonElement>("button.carousel__back-button, button.carousel__next-button")) {
              if (!current.buttons.has(button)) current.buttons.set(button, button.disabled);
              const atStart = viewport.scrollLeft <= 1;
              const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1;
              button.disabled = button.matches(".carousel__back-button") ? atStart : atEnd;
            }
            for (const child of root.children) {
              if (!child.contains(viewport) && child.querySelector(".carousel__back-button, .carousel__next-button")) {
                child.classList.add("saf-carousel-pagination"); current.pagination.add(child);
              }
            }
          };
          this.carousels.set(root, current);
          root.classList.add("saf-compact-carousel");
          tray.classList.add("saf-compact-tray");
          viewport.classList.add("saf-compact-viewport");
          if (current.tabindex === null) viewport.tabIndex = 0;
          root.addEventListener("click", event => {
            const button = (event.target as Element)?.closest(".carousel__back-button, .carousel__next-button");
            if (!button || !root.contains(button)) return;
            event.preventDefault(); event.stopImmediatePropagation();
            const direction = button.matches(".carousel__back-button") ? -1 : 1;
            viewport.scrollBy({left: direction * viewport.clientWidth,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
          }, {capture: true, signal: events.signal});
          viewport.addEventListener("scroll", current.update, {passive: true, signal: events.signal});
          current.observer.observe(viewport);
          current.mutations.observe(tray, {attributes: true, attributeFilter: ["style"], childList: true, subtree: true});
        }
        state.update();
      }
    }
    private slideWidth(tray: HTMLElement): string | null {
      const slide = tray.querySelector<HTMLElement>(":scope > .carousel__slide");
      if (!slide || !tray.style.width.endsWith("%") || !slide.style.width.endsWith("%")) return null;
      const percent = parseFloat(tray.style.width) * parseFloat(slide.style.width) / 100;
      return Number.isFinite(percent) && percent > 0 && percent <= 100.01 ? `${Math.min(100, percent)}%` : null;
    }
    private restore(state: CompactCarousel): void {
      this.carousels.delete(state.root);
      state.events.abort(); state.observer.disconnect(); state.mutations.disconnect();
      state.root.classList.remove("saf-compact-carousel", "saf-empty-carousel");
      state.tray.classList.remove("saf-compact-tray");
      state.tray.style.removeProperty("--saf-slide-width");
      state.viewport.classList.remove("saf-compact-viewport");
      state.viewport.scrollLeft = 0;
      if (state.tabindex === null) state.viewport.removeAttribute("tabindex"); else state.viewport.setAttribute("tabindex", state.tabindex);
      for (const [button, disabled] of state.buttons) button.disabled = disabled;
      for (const child of state.pagination) child.classList.remove("saf-carousel-pagination");
    }
    clear(): void {
      for (const el of this.wrappers) el.classList.remove("saf-removed-wrapper");
      this.wrappers.clear();
      for (const state of this.carousels.values()) this.restore(state);
    }
  }
}
