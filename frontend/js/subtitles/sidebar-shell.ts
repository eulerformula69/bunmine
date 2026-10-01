import { resizer,sidebar,toggleBtn } from "../core/dom.js";

import { state } from "../core/state.js";

import { i18n } from "../core/i18n.js";

export function initSubtitleSidebarToggle() {
    if (!toggleBtn || !sidebar || !resizer) return;
    if (toggleBtn.dataset.sidebarInitialized === "true") return;

    toggleBtn.dataset.sidebarInitialized = "true";

    const closeButton = document.getElementById("closeSubtitleSidebarBtn");

    const setOpen = (isOpen: boolean) => {
        if (!isOpen) {
            const currentWidth = sidebar.style.width || `${Math.round(sidebar.getBoundingClientRect().width)}px`;
            if (currentWidth && currentWidth !== "0px") state.lastSidebarWidth = currentWidth;

            sidebar.classList.add("hidden");
            resizer.classList.add("hidden");
            sidebar.style.width = "0px";
        } else {
            sidebar.classList.remove("hidden");
            resizer.classList.remove("hidden");

            const saved = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}").sidebarWidth;
            sidebar.style.width = state.lastSidebarWidth || saved || "320px";
        }

        toggleBtn.classList.toggle("active", isOpen);
        toggleBtn.setAttribute("aria-expanded", String(isOpen));
        updateSubtitleSidebarLabels();
    };

    toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(sidebar.classList.contains("hidden"));
    });

    closeButton?.addEventListener("click", () => setOpen(false));
    setOpen(!sidebar.classList.contains("hidden"));
}

export function updateSubtitleSidebarLabels() {
    if (!toggleBtn || !sidebar) return;

    const dict = i18n[state.currentLang]?.dict || i18n.en.dict;
    const isOpen = !sidebar.classList.contains("hidden");
    const toggleLabel = dict[isOpen ? "hideSidebar" : "showSidebar"];
    const closeButton = document.getElementById("closeSubtitleSidebarBtn");
    const sidebarTitle = sidebar.querySelector(".subtitle-sidebar-header h2");

    toggleBtn.title = toggleLabel;
    toggleBtn.setAttribute("aria-label", toggleLabel);
    sidebar.setAttribute("aria-label", dict.sidebarTitle || "Sidebar");
    if (sidebarTitle) sidebarTitle.textContent = dict.sidebarTitle || "Sidebar";
    if (closeButton) {
        closeButton.title = dict.closeSidebar || "Close sidebar";
        closeButton.setAttribute("aria-label", closeButton.title);
    }
}

export function initSubtitleSidebarResizer() {
    if (!resizer || !sidebar) return;
    if (resizer.dataset.sidebarResizeInitialized === "true") return;

    resizer.dataset.sidebarResizeInitialized = "true";

    resizer.addEventListener("mousedown", () => {
        state.isResizing = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!state.isResizing) return;

        const newWidth = window.innerWidth - e.clientX;

        if (newWidth > 150 && newWidth < window.innerWidth * 0.5) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener("mouseup", () => {
        if (!state.isResizing) return;

        state.isResizing = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";

        const settings = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}");
        settings.sidebarWidth = sidebar.style.width;
        localStorage.setItem("subtitlePlayerSettings", JSON.stringify(settings));
    });
}
