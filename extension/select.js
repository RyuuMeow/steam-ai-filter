"use strict";
var SAFSelect;
(function (SAFSelect) {
    // Keep the select as the settings model; an in-flow list gives the extension
    // host real content to measure instead of a clipped native picker top layer.
    function enhance(select) {
        const field = select.closest(".field");
        const label = field.querySelector("[data-i18n]");
        label.id = `${select.id}-label`;
        const root = document.createElement("div");
        root.className = "select-control";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "select-trigger";
        trigger.id = `${select.id}-trigger`;
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-labelledby", label.id);
        const value = document.createElement("span"), chevron = document.createElement("img");
        chevron.src = "icons/down.svg";
        chevron.alt = "";
        trigger.append(value, chevron);
        const list = document.createElement("div");
        list.className = "select-options";
        list.id = `${select.id}-options`;
        list.role = "listbox";
        list.hidden = true;
        list.setAttribute("aria-labelledby", label.id);
        trigger.setAttribute("aria-controls", list.id);
        const options = Array.from(select.options, (option, index) => {
            const item = document.createElement("div");
            item.role = "option";
            item.id = `${select.id}-option-${index}`;
            item.className = "select-option";
            item.addEventListener("pointerdown", event => event.preventDefault());
            item.addEventListener("click", () => choose(index));
            list.append(item);
            return item;
        });
        select.hidden = true;
        select.after(root);
        root.append(trigger, list);
        if (label instanceof HTMLLabelElement)
            label.htmlFor = trigger.id;
        let active = select.selectedIndex, search = "", searchedAt = 0;
        function highlight(index) {
            active = Math.max(0, Math.min(options.length - 1, index));
            options.forEach((item, i) => item.classList.toggle("is-active", i === active));
            trigger.setAttribute("aria-activedescendant", options[active].id);
        }
        function close() {
            list.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            trigger.removeAttribute("aria-activedescendant");
        }
        function open() {
            if (trigger.disabled)
                return;
            for (const other of document.querySelectorAll('.select-trigger[aria-expanded="true"]'))
                if (other !== trigger)
                    other.click();
            list.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            highlight(select.selectedIndex);
        }
        function choose(index) {
            if (select.disabled)
                return;
            select.selectedIndex = index;
            close();
            sync();
            trigger.focus({ preventScroll: true });
            select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        function sync() {
            value.textContent = select.selectedOptions[0]?.textContent || "";
            trigger.disabled = select.disabled;
            options.forEach((item, i) => {
                item.textContent = select.options[i].textContent;
                item.setAttribute("aria-selected", String(i === select.selectedIndex));
            });
            if (!list.hidden)
                highlight(select.selectedIndex);
        }
        trigger.onclick = event => { event.preventDefault(); list.hidden ? open() : close(); };
        trigger.onkeydown = event => {
            if (event.key === "Escape") {
                if (!list.hidden) {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
                return;
            }
            if (event.key === "Tab") {
                close();
                return;
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                if (list.hidden) {
                    open();
                    if (event.key === "ArrowDown" || event.key === "ArrowUp")
                        return;
                }
                highlight(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : active + (event.key === "ArrowDown" ? 1 : -1));
            }
            else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                list.hidden ? open() : choose(active);
            }
            else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                if (list.hidden)
                    open();
                search = Date.now() - searchedAt > 700 ? event.key : search + event.key;
                searchedAt = Date.now();
                const index = options.findIndex(item => item.textContent?.toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));
                if (index >= 0)
                    highlight(index);
            }
        };
        document.addEventListener("pointerdown", event => { if (!root.contains(event.target))
            close(); });
        root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget))
            close(); });
        select.addEventListener("change", sync);
        sync();
        return sync;
    }
    SAFSelect.enhance = enhance;
})(SAFSelect || (SAFSelect = {}));
