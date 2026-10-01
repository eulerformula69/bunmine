import { clearSearchMatches,initSubtitleSearchPanel } from "./search-controller.js";

import { initSubtitleSidebarResizer,initSubtitleSidebarToggle } from "./sidebar-shell.js";

import { initSubtitleContextDrag } from "./context-drag.js";

import { state } from "../core/state.js";

import { findSubtitleIndexForOffset,findSubtitleIndexForPlaybackTime } from "./navigation.js";

import { overlay,video } from "../core/dom.js";

import { renderSubtitleOverlay } from "./subtitles.js";

import { ankiSubtitleHighlighter } from "../highlighter/anki-highlighter.js";

import { renderSubtitles } from "./sidebar-render.js";

// sidebar bootstrap

export function initSubtitleSidebar() {
    initSubtitleSearchPanel();
    initSubtitleSidebarToggle();
    initSubtitleSidebarResizer();
    initSubtitleContextDrag();
}

// navigation

export function seekBySubtitle(offset: number) {
    if (!state.subtitles.length) return;

    clearSearchMatches();

    const currentIdx = findSubtitleIndexForOffset(state.subtitles, video.currentTime, offset);

    const targetSub = state.subtitles[currentIdx];

    video.pause();
    video.currentTime = targetSub.start + 0.05;

    renderSubtitleOverlay({
        overlay,
        text: targetSub.text,
        highlighter: ankiSubtitleHighlighter
    });

    syncSubtitleStyle(currentIdx);
}

export function syncSubtitleStyle(idx: number) {
    state.lastClickedSubtitleIdx = idx;

    renderSubtitles();

    state.subtitleElements[idx]?.div.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function restoreSubtitleFromCurrentTime() {
    const idx = findSubtitleIndexForPlaybackTime(state.subtitles, video.currentTime, state.globalSubDelay);

    if (idx === -1) return;

    syncSubtitleStyle(idx);
}
