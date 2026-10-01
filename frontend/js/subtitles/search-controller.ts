import { ensureSubtitleSearchPanel } from "./search-panel.js";

import { sidebar,video } from "../core/dom.js";

import { state } from "../core/state.js";

import { goToNextSubtitle,goToPreviousSubtitle } from "./sidebar-actions.js";

import { renderSubtitles } from "./sidebar-render.js";

import { SubtitleSearchResult,buildSubtitleTimeSearchMatches,findSubtitleIndexByTime,findSubtitleTextMatchesInCues,getSubtitleSearchHaystackForText,parseSubtitleSearchTime } from "./search.js";

import { tokenizeJapaneseTextSync } from "../japanese/japanese-tokenizer.js";

import { syncSubtitleStyle } from "./subtitles-sidebar.js";

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
