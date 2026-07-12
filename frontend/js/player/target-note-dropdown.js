function createTargetNoteDropdownController(options) {
    const { select } = options;
    let measureCanvas = null;
    function getElements() {
        return {
            dropdown: document.getElementById("targetNoteDropdown"),
            button: document.getElementById("targetNoteButton"),
            buttonText: document.getElementById("targetNoteButtonText"),
            menu: document.getElementById("targetNoteMenu")
        };
    }
    function updateButtonText() {
        const { dropdown, button, buttonText } = getElements();
        if (!button || !buttonText)
            return;
        const selectedOption = select.selectedOptions[0];
        const text = selectedOption?.textContent || options.getLastAddedLabel();
        const title = selectedOption?.title || text;
        buttonText.textContent = text;
        button.title = title;
        requestAnimationFrame(() => {
            const availableWidth = 42;
            const textWidth = buttonText.scrollWidth;
            const overflow = textWidth > availableWidth;
            buttonText.classList.toggle("is-overflowing", overflow);
            if (!dropdown)
                return;
            dropdown.style.setProperty("--note-text-width", `${availableWidth}px`);
            const distance = overflow ? -(textWidth - availableWidth) : 0;
            dropdown.style.setProperty("--note-scroll-distance", `${distance}px`);
        });
    }
    function updateMenuWidth() {
        const { dropdown } = getElements();
        if (!dropdown)
            return;
        measureCanvas || (measureCanvas = document.createElement("canvas"));
        const context = measureCanvas.getContext("2d");
        if (!context)
            return;
        context.font = "12px sans-serif";
        const longestWordWidth = Array.from(select.options).reduce((max, option) => {
            const normalized = String(option.textContent || "").trim();
            const words = /\s/.test(normalized)
                ? normalized.split(/\s+/).map((word) => word.trim()).filter(Boolean)
                : [normalized];
            const optionWidth = words.reduce((wordMax, word) => Math.max(wordMax, context.measureText(word).width), 0);
            return Math.max(max, optionWidth);
        }, 0);
        const width = Math.ceil(Math.min(Math.max(longestWordWidth + 14, 64), 260));
        dropdown.style.setProperty("--note-menu-width", `${width}px`);
    }
    function rebuildMenu() {
        const { menu } = getElements();
        if (!menu)
            return;
        menu.innerHTML = "";
        Array.from(select.options).forEach((option) => {
            const item = document.createElement("div");
            item.className = "note-dropdown-item";
            item.textContent = option.textContent;
            item.title = option.title || option.textContent || "";
            item.dataset.value = option.value;
            item.classList.toggle("active", option.value === select.value);
            item.addEventListener("click", () => {
                select.value = option.value;
                select.dispatchEvent(new Event("change"));
                menu.classList.add("hidden");
            });
            menu.appendChild(item);
        });
        updateMenuWidth();
    }
    async function refresh({ preserveSelection = true } = {}) {
        const previousValue = preserveSelection ? select.value : "";
        select.innerHTML = "";
        const autoOption = document.createElement("option");
        autoOption.value = "";
        autoOption.textContent = options.getLastAddedLabel();
        autoOption.title = options.getLastAddedTitle();
        select.appendChild(autoOption);
        select.title = options.getLastAddedTitle();
        const ankiUrl = options.getAnkiUrl();
        const deckName = options.getDeckName();
        if (!ankiUrl || !deckName) {
            updateButtonText();
            rebuildMenu();
            return;
        }
        try {
            const ids = await options.fetchDeckNoteIds(ankiUrl, deckName);
            const recentIds = ids.slice(-50).reverse();
            if (recentIds.length) {
                const infoList = await options.fetchNotesInfo(ankiUrl, recentIds);
                const infoById = new Map(infoList.map((item) => [Number(item.noteId), item]));
                recentIds.forEach((id) => {
                    const option = document.createElement("option");
                    const preview = options.pickNotePreviewText(infoById.get(Number(id)));
                    const shortPreview = preview.length > 70 ? `${preview.slice(0, 67)}...` : preview;
                    option.value = String(id);
                    option.textContent = shortPreview || `#${id}`;
                    option.title = preview || `#${id}`;
                    select.appendChild(option);
                });
            }
            select.value = previousValue && recentIds.includes(Number(previousValue))
                ? previousValue
                : "";
        }
        catch (error) {
            console.error("Could not load deck notes:", error);
        }
        updateButtonText();
        rebuildMenu();
    }
    function init() {
        const { button, menu } = getElements();
        if (!button || !menu)
            return;
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            menu.classList.toggle("hidden");
            if (!menu.classList.contains("hidden")) {
                void refresh({ preserveSelection: true });
            }
        });
        document.addEventListener("click", (event) => {
            const { dropdown, menu: currentMenu } = getElements();
            if (dropdown && currentMenu && !dropdown.contains(event.target)) {
                currentMenu.classList.add("hidden");
            }
        });
        select.addEventListener("change", () => {
            updateButtonText();
            rebuildMenu();
        });
        updateButtonText();
        rebuildMenu();
    }
    return { refresh, init };
}
