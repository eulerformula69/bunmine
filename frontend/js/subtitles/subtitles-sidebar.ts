import { initSubtitleContextDrag, isSubtitleContextDragging } from "./context-drag.js";
import { overlay, resizer, sidebar, toggleBtn, video } from "../core/dom.js";
import { state } from "../core/state.js";
import { i18n } from "../core/i18n.js";
import { RuntimeSubtitleCue } from "./model.js";
import { getCurrentSubtitleIndexForNavigation, goToNextSubtitle, goToPreviousSubtitle } from "./sidebar-actions.js";
import { buildSubtitleContextSelection } from "./context-selection.js";
import { ensureSubtitleSearchPanel } from "./search-panel.js";
import { renderSubtitles } from "./sidebar-render.js";
import { SubtitleSearchResult, buildSubtitleTimeSearchMatches, findSubtitleIndexByTime, findSubtitleTextMatchesInCues, getSubtitleSearchHaystackForText, parseSubtitleSearchTime } from "./search.js";
import { tokenizeJapaneseTextSync } from "../japanese/japanese-tokenizer.js";
import { findSubtitleIndexForOffset, findSubtitleIndexForPlaybackTime } from "./navigation.js";
import { renderSubtitleOverlay } from "./subtitles.js";
import { ankiSubtitleHighlighter } from "../highlighter/anki-highlighter.js";

// sidebar bootstrap

export function initSubtitleSidebar() {
    initSubtitleSearchPanel();
    initSubtitleSidebarToggle();
    initSubtitleSidebarResizer();
    initSubtitleContextDrag();
}

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

// subtitle context

export interface SubtitleContextRange {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
    backDepth: number;
    forwardDepth: number;
}

export interface SubtitleContextSelectionState extends SubtitleContextRange {
    items: RuntimeSubtitleCue[];
    text: string;
    startTime: number;
    endTime: number;
}

export function normalizeSubtitleContextDepth(value: unknown): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return 0;

    return Math.max(0, Math.floor(numericValue));
}

export function getSubtitleContextRange(currentIdx: number | null = null): SubtitleContextRange {
    const resolvedCurrentIdx = Number.isInteger(currentIdx)
        ? currentIdx
        : (
            Number.isInteger(state.lastClickedSubtitleIdx) &&
            state.lastClickedSubtitleIdx >= 0 &&
            state.lastClickedSubtitleIdx < state.subtitles.length
                ? state.lastClickedSubtitleIdx
                : getCurrentSubtitleIndexForNavigation()
        );

    if (!state.subtitles.length || resolvedCurrentIdx < 0 || resolvedCurrentIdx >= state.subtitles.length) {
        return {
            currentIdx: -1,
            startIdx: -1,
            endIdx: -1,
            backDepth: 0,
            forwardDepth: 0
        };
    }

    const backDepth = normalizeSubtitleContextDepth(state.subtitleContextBackDepth);
    const forwardDepth = normalizeSubtitleContextDepth(state.subtitleContextForwardDepth);

    return {
        currentIdx: resolvedCurrentIdx,
        startIdx: Math.max(0, resolvedCurrentIdx - backDepth),
        endIdx: Math.min(state.subtitles.length - 1, resolvedCurrentIdx + forwardDepth),
        backDepth,
        forwardDepth
    };
}

export function getSubtitleContextSelection(currentIdx: number | null = null): SubtitleContextSelectionState {
    const range = getSubtitleContextRange(currentIdx);

    if (range.currentIdx < 0) {
        return {
            ...range,
            items: [],
            text: "",
            startTime: 0,
            endTime: 0
        };
    }

    const selection = buildSubtitleContextSelection(
        state.subtitles,
        range.currentIdx,
        range.backDepth,
        range.forwardDepth
    );
    const items = state.subtitles.slice(range.startIdx, range.endIdx + 1);

    return {
        ...range,
        items,
        text: selection?.text ?? "",
        startTime: selection?.startTime ?? 0,
        endTime: selection?.endTime ?? 0
    };
}

export function setSubtitleContextDepths({
    backDepth = state.subtitleContextBackDepth,
    forwardDepth = state.subtitleContextForwardDepth
}: {
    backDepth?: number;
    forwardDepth?: number;
} = {}) {
    state.subtitleContextBackDepth = normalizeSubtitleContextDepth(backDepth);
    state.subtitleContextForwardDepth = normalizeSubtitleContextDepth(forwardDepth);

    if (isSubtitleContextDragging()) {
        updateSubtitleContextRangePreview();
        return;
    }

	requestAnimationFrame(() => {
		restoreSubtitleFromCurrentTime();
	});
}

export function updateSubtitleContextRangePreview() {
    const context = getSubtitleContextRange();

    state.subtitleElements.forEach(({ div, index }) => {
        const isInRange = context.currentIdx >= 0 && index >= context.startIdx && index <= context.endIdx;
        div.classList.toggle("capture-range", isInRange);
        div.classList.toggle("active", index === context.currentIdx);
    });
}

export function resetSubtitleContextDepths() {
    setSubtitleContextDepths({
        backDepth: 0,
        forwardDepth: 0
    });
}

export function isSubtitleContextDepthDefault() {
    return state.subtitleContextBackDepth === 0 && state.subtitleContextForwardDepth === 0;
}

// search

export function initSubtitleSearchPanel() {
    ensureSubtitleSearchPanel(
        sidebar,
        {
            query: state.subtitleSearchQuery || "",
            timeSeconds: state.subtitleSearchTimeSeconds
        },
        {
            onWordFocus(wordInput, timeInput) {
                state.subtitleSearchMode = "word";
                state.subtitleSearchTimeSeconds = null;

                if (timeInput) timeInput.value = "";

                if (!wordInput.value.trim()) {
                    clearSearchMatches();
                }
            },
            onTimeFocus(wordInput, timeInput) {
                state.subtitleSearchMode = "time";
                state.subtitleSearchQuery = "";

                if (wordInput) wordInput.value = "";

                if (!timeInput.value.trim()) {
                    clearSearchMatches();
                }
            },
            onWordInput(value, timeInput) {
                state.subtitleSearchMode = "word";
                state.subtitleSearchQuery = value;
                state.subtitleSearchTimeSeconds = null;

                if (timeInput) timeInput.value = "";

                setSearchMatches(findSubtitleTextMatches(state.subtitleSearchQuery));
            },
            onWordEnter(event, value) {
                if (event.key !== "Enter") return;

                event.preventDefault();

                if (event.ctrlKey) {
                    commitSearchMatch();
                    return;
                }

                if (!state.subtitleSearchMatches.length) {
                    setSearchMatches(findSubtitleTextMatches(value), 0);
                    return;
                }

                goToSearchMatch(event.shiftKey ? -1 : 1);
            },
            onTimeInput(value, wordInput) {
                state.subtitleSearchMode = "time";
                state.subtitleSearchQuery = "";

                if (wordInput) wordInput.value = "";

                const seconds = parseSearchTime(value);

                if (!Number.isFinite(seconds)) {
                    state.subtitleSearchTimeSeconds = null;
                    clearSearchMatches();
                    return;
                }

                state.subtitleSearchTimeSeconds = seconds;
                setSearchMatches(buildTimeSearchMatches(seconds));
            },
            onTimeEnter(event) {
                if (event.key !== "Enter") return;

                event.preventDefault();

                if (event.ctrlKey) {
                    activateTimeSearch({ commit: true });
                    return;
                }

                activateTimeSearch({ commit: false });
            },
            onPrevious() {
                if (hasActiveSubtitleSearch()) {
                    goToSearchMatch(-1);
                    return;
                }

                goToPreviousSubtitle();
            },
            onNext() {
                if (hasActiveSubtitleSearch()) {
                    goToSearchMatch(1);
                    return;
                }

                goToNextSubtitle();
            },
            onCommit() {
                if (state.subtitleSearchMode === "time") {
                    activateTimeSearch({ commit: true });
                    return;
                }

                commitSearchMatch();
            }
        }
    );
}
export function hasActiveSubtitleSearch() {
    return state.subtitleSearchMatches.length > 0;
}

export function clearSearchMatches() {
    if (!state.subtitleSearchMatches.length && state.subtitleSearchIndex === -1) return;
    state.subtitleSearchMatches = [];
    state.subtitleSearchIndex = -1;

    renderSubtitles();
}

export function setSearchMatches(matches: SubtitleSearchResult[], index = 0) {
    state.subtitleSearchMatches = Array.isArray(matches) ? matches : [];
    state.subtitleSearchIndex = state.subtitleSearchMatches.length ? index : -1;

    renderSubtitles();
    scrollToSearchMatch(getCurrentSearchMatch());
}

export function findSubtitleTextMatches(query: string): SubtitleSearchResult[] {
    return findSubtitleTextMatchesInCues(
        state.subtitles,
        query,
        (text) => tokenizeJapaneseTextSync(text) || []
    );
}

export function getSubtitleSearchHaystack(text: string): string {
    return getSubtitleSearchHaystackForText(
        text,
        (value) => tokenizeJapaneseTextSync(value) || []
    );
}

export function parseSearchTime(value: string | undefined): number | null {
    return parseSubtitleSearchTime(value);
}

export function findSubtitleByTime(seconds: number): number {
    return findSubtitleIndexByTime(state.subtitles, seconds, state.globalSubDelay);
}

export function buildTimeSearchMatches(seconds: number): SubtitleSearchResult[] {
    return buildSubtitleTimeSearchMatches(state.subtitles, seconds, state.globalSubDelay);
}
export function activateTimeSearch({ commit = false } = {}) {
    const timeInput = document.getElementById("subtitleTimeSearchInput") as HTMLInputElement | null;
    const seconds = parseSearchTime(timeInput?.value);

    if (!Number.isFinite(seconds)) return;

    state.subtitleSearchMode = "time";
    state.subtitleSearchTimeSeconds = seconds;
    state.subtitleSearchQuery = "";

    const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;
    if (wordInput) wordInput.value = "";

    setSearchMatches(buildTimeSearchMatches(seconds));

    if (commit) {
        commitSearchMatch();
    }
}

export function getCurrentSearchMatch() {
    if (!state.subtitleSearchMatches.length) return null;
    if (state.subtitleSearchIndex < 0) return null;

    return state.subtitleSearchMatches[state.subtitleSearchIndex] || null;
}

export function scrollToSearchMatch(match) {
    if (!match) return;

    const el = sidebar.querySelector(
        `.subtitle[data-index="${match.subtitleIndex}"]`
    );

    if (!el) return;

    el.scrollIntoView({
        block: "center",
        behavior: "smooth"
    });
}

export function goToSearchMatch(direction = 1) {
    if (!state.subtitleSearchMatches.length) {
        if (state.subtitleSearchMode === "word") {
            const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;
            state.subtitleSearchQuery = wordInput?.value || "";
            state.subtitleSearchMatches = findSubtitleTextMatches(state.subtitleSearchQuery);
        }

        if (state.subtitleSearchMode === "time") {
            const timeInput = document.getElementById("subtitleTimeSearchInput") as HTMLInputElement | null;
            const seconds = parseSearchTime(timeInput?.value);

            if (Number.isFinite(seconds)) {
                state.subtitleSearchTimeSeconds = seconds;
                state.subtitleSearchMatches = buildTimeSearchMatches(seconds);
            }
        }

        state.subtitleSearchIndex = state.subtitleSearchMatches.length ? 0 : -1;
    }

    if (!state.subtitleSearchMatches.length) return;

    state.subtitleSearchIndex += direction;

    if (state.subtitleSearchIndex >= state.subtitleSearchMatches.length) {
        state.subtitleSearchIndex = 0;
    }

    if (state.subtitleSearchIndex < 0) {
        state.subtitleSearchIndex = state.subtitleSearchMatches.length - 1;
    }

    const match = getCurrentSearchMatch();

    renderSubtitles();
    scrollToSearchMatch(match);
}

export function commitSearchMatch() {
    const match = getCurrentSearchMatch();

    if (!match) return;

    const sub = state.subtitles[match.subtitleIndex];

    if (!sub) return;

    if (match.type === "time" && Number.isFinite(match.seconds)) {
        video.currentTime = match.seconds;
    } else {
        video.currentTime = sub.start + state.globalSubDelay;
    }

    video.pause();
    syncSubtitleStyle(match.subtitleIndex);

    state.subtitleSearchMatches = [];
    state.subtitleSearchIndex = -1;
    renderSubtitles();
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
