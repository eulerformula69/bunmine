import { getPrimarySubtitleIndex } from "./timing.js";
import { overlay, sidebar, toggleBtn, video } from "../core/dom.js";
import { state } from "../core/state.js";
import { findSubtitleIndexForOffset } from "./navigation.js";
import { clearSearchMatches, syncSubtitleStyle, updateSubtitleSidebarLabels } from "./subtitles-sidebar.js";
import { renderSubtitleOverlay } from "./subtitles.js";
import { ankiSubtitleHighlighter } from "../highlighter/anki-highlighter.js";
import { playMedia } from "../video/media-playback.js";
import { updateSubtitleSearchPanelLabels } from "./search-panel.js";
export function getCurrentSubtitleIndexForNavigation(): number {
    const primaryIndex = getPrimarySubtitleIndex();
    if (primaryIndex !== -1) return primaryIndex;
    const adjustedTime = video.currentTime - state.globalSubDelay;

    const nextIndex = state.subtitles.findIndex((cue) => cue.start > adjustedTime);
    if (nextIndex !== -1) return nextIndex;

    return state.subtitles.length - 1;
}

export function goToPreviousSubtitle(): void {
    if (!state.subtitles.length) return;

    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const referenceTime = state.subtitles[currentIndex]?.start ?? (video.currentTime - state.globalSubDelay);
    const targetIndex = findSubtitleIndexForOffset(state.subtitles, referenceTime, -1);

    video.currentTime = Math.max(0, state.subtitles[targetIndex].start + state.globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
}

export function goToNextSubtitle(): void {
    if (!state.subtitles.length) return;

    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const referenceTime = state.subtitles[currentIndex]?.start ?? (video.currentTime - state.globalSubDelay);
    const targetIndex = findSubtitleIndexForOffset(state.subtitles, referenceTime, 1);

    video.currentTime = Math.max(0, state.subtitles[targetIndex].start + state.globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
}

export function replayCurrentSubtitle(): void {
    if (!state.subtitles.length) return;

    clearSearchMatches();

    const currentIndex = getPrimarySubtitleIndex() !== -1
        ? getPrimarySubtitleIndex()
        : getCurrentSubtitleIndexForNavigation();
    const targetSub = state.subtitles[currentIndex];

    if (!targetSub) return;

    video.currentTime = Math.max(0, targetSub.start + state.globalSubDelay + 0.01);

    renderSubtitleOverlay({
        overlay,
        text: targetSub.text,
        highlighter: ankiSubtitleHighlighter
    });

    syncSubtitleStyle(currentIndex);
    void playMedia(video);
}

export function focusSubtitleWordSearch(): void {
    if (sidebar?.classList.contains("hidden")) {
        toggleBtn?.click();
    }

    requestAnimationFrame(() => {
        const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;

        wordInput?.focus();
        wordInput?.select();
    });
}

export function updateSubtitleSearchPanelLanguage(): void {
    updateSubtitleSearchPanelLabels();
    updateSubtitleSidebarLabels();
}
