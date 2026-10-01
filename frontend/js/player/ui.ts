import { logger } from "../core/logger.js";


import { i18n } from "../core/i18n.js";

import { state } from "../core/state.js";

import { addCardToDeck,addKnownBasicBtn,fullscreenBtn,playPause,settingsBtn,video } from "../core/dom.js";

export { showToast, showActionToast } from "../core/notifications.js";

export function updatePlayButton(): void {
    playPause.textContent = video.paused ? "▶" : "⏸";
}

export function updateFullscreenButtonText(): void {
    if (!fullscreenBtn) return;

    const isFullscreen = !!document.fullscreenElement;
    const key = isFullscreen ? "exitFullscreen" : "fullscreen";
    const label = i18n[state.currentLang].dict[key] || (isFullscreen ? "Exit Fullscreen" : "Fullscreen");

    fullscreenBtn.textContent = "⛶";
    fullscreenBtn.title = label;
    fullscreenBtn.setAttribute("aria-label", label);
}

export function updateIconButtons(): void {
    if (settingsBtn) {
        const settingsLabel = i18n[state.currentLang].dict.settings || "Settings";
        settingsBtn.textContent = "⚙";
        settingsBtn.title = settingsLabel;
        settingsBtn.setAttribute("aria-label", settingsLabel);
    }

    updateFullscreenButtonText();
}

export async function toggleFullscreenMode(): Promise<void> {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (err) {
        logger.error("Fullscreen toggle failed:", err);
    }
}

export function isTypingTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// add dynamic frame step
export const FRAME_STEP_SECONDS = 1 / 24;

export function stepFrame(direction: number): void {
    if (!video.duration || Number.isNaN(video.duration)) return;

    video.pause();

    const nextTime = Math.max(
        0,
        Math.min(video.duration, video.currentTime + (FRAME_STEP_SECONDS * direction))
    );

    video.currentTime = nextTime;

}

export function seekBySeconds(seconds: number): void {
    if (!video.duration || Number.isNaN(video.duration)) return;

    const nextTime = Math.max(
        0,
        Math.min(video.duration, video.currentTime + seconds)
    );

    video.currentTime = nextTime;

}

export function getCleanSelectedText(): string {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return "";
    }

    return selection
        .toString()
        .trim()
        .replace(/\s+/g, " ");
}

export function showAddKnownBasicButtonForSelection(): void {
    if (!addKnownBasicBtn && !addCardToDeck) return;

    const word = getCleanSelectedText();

    if (!word) {
        hideAddKnownBasicButton();
        return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        hideAddKnownBasicButton();
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
        hideAddKnownBasicButton();
        return;
    }

    state.selectedKnownBasicWord = word;

    const main = document.getElementById("main")!;
    const mainRect = main.getBoundingClientRect();

    const centerLeft = rect.left - mainRect.left + rect.width / 2;
    const safeTop = Math.max(12, rect.top - mainRect.top - 42);

    if (addKnownBasicBtn) {
        addKnownBasicBtn.style.left = `${centerLeft}px`;
        addKnownBasicBtn.style.top = `${safeTop}px`;
		addKnownBasicBtn.style.transform = addCardToDeck
			? "translateX(-105%)"
			: "translateX(-50%)";
        addKnownBasicBtn.classList.remove("hidden");
    }

    if (addCardToDeck) {
        addCardToDeck.style.left = `${centerLeft}px`;
        addCardToDeck.style.top = `${safeTop}px`;
        addCardToDeck.style.transform = "translateX(5%)";
        addCardToDeck.classList.remove("hidden");
    }
}

export function hideAddKnownBasicButton(): void {
    addKnownBasicBtn?.classList.add("hidden");
    addCardToDeck?.classList.add("hidden");
    state.selectedKnownBasicWord = "";
}
