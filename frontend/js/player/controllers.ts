import { createKnownBasicActions } from "./known-basic-actions.js";

import { getJapaneseTokenizer,tokenizeJapaneseText } from "../japanese/japanese-tokenizer.js";

import { apiJson } from "../core/api.js";

import { t } from "../core/translate.js";
import { hideAddKnownBasicButton,showToast } from "./ui.js";

import { addRuntimeKnownBasicWord,ankiRuntimeWordStatusMap } from "../highlighter/word-status-store.js";

import { getCurrentSubtitle,getPrimarySubtitleIndex } from "../subtitles/timing.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { overlay,video } from "../core/dom.js";

import { ankiSubtitleHighlighter,collectSubtitleCandidates,ensureStatusesForCandidates,ensureStatusesForSubtitleText,rerenderCurrentSubtitleWithAnkiHighlighter } from "../highlighter/anki-highlighter.js";

import { createRuntimePrefetchController } from "./runtime-prefetch.js";

import { state } from "../core/state.js";

import { getHighlightWordFieldNames,loadHighlightWordIndexes,refreshKnownAnkiWordFromNote } from "../highlighter/word-index-sync.js";

import { getSubtitleContextSelection } from "../subtitles/context-range.js";

import { createAnkiMediaController } from "./anki-actions.js";

import { candidateExports } from "./candidate-bindings.js";

import { getCurrentVideoPayload } from "../video/media-payload.js";

import { getValidatedVolume } from "../video/audio-preview.js";

export const knownBasicActions = createKnownBasicActions({
    tokenize: (text) => tokenizeJapaneseText(text),
    request: apiJson,
    translate: t,
    toast: showToast,
    markMature: (word) => {
        addRuntimeKnownBasicWord?.(word);
        const subtitle = getCurrentSubtitle?.();
        renderSubtitleOverlay({
            overlay,
            text: subtitle ? subtitle.text : "",
            highlighter: ankiSubtitleHighlighter,
        });
    },
    hideButton: hideAddKnownBasicButton,
    clearSelection: () => window.getSelection()?.removeAllRanges(),
});

export const addWordToKnownBasic = knownBasicActions.addWord;

export const runtimePrefetchController = createRuntimePrefetchController({
    state: state,
    getSubtitles: () => state.subtitles,
    getCurrentSubtitle: () => getCurrentSubtitle?.(),
    loadWordIndexes: () => loadHighlightWordIndexes?.() || Promise.resolve(),
    loadTokenizer: getJapaneseTokenizer,
    collectCandidates: collectSubtitleCandidates,
    hasStatus: (candidate) => ankiRuntimeWordStatusMap.has(candidate),
    ensureStatuses: ensureStatusesForCandidates,
    rerender: () => rerenderCurrentSubtitleWithAnkiHighlighter?.(),
});

export async function prefetchRuntimeStatusesForAllSubtitles(options = {}) {
    await runtimePrefetchController.prefetch(options);
}

export function getActiveSubtitleIndex() {
    return getPrimarySubtitleIndex();
}

export const ankiMediaController = createAnkiMediaController({
    validateExportSnapshot: (snapshot) => candidateExports.validate(snapshot),
    translate: t,
    getVideoPayload: getCurrentVideoPayload,
    getVideoCurrentTime: () => video.currentTime,
    getValidatedVolume,
    getActiveSubtitleIndex,
    getSubtitleStart: (index) => state.subtitles[index].start,
    getSubtitleContext: getSubtitleContextSelection,
    getGlobalSubtitleDelay: () => state.globalSubDelay,
    resetRuntimeHighlightPrefetch: () => {
        state.runtimePrefetchWindowStart = -1;
        state.runtimePrefetchWindowEnd = -1;
        state.runtimeNextPrefetchStart = 0;
        state.runtimeHighlightPrefetchReady = false;
    },
    refreshKnownWord: (payload) => refreshKnownAnkiWordFromNote?.(payload),
    getHighlightWordFields: () => getHighlightWordFieldNames?.(),
    ensureSubtitleStatuses: ensureStatusesForSubtitleText,
    prefetchSubtitleStatuses: () => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    }
});

export const buildCurrentAnkiMediaSnapshot = ankiMediaController.buildSnapshot;

export const updateAnkiNoteWithSnapshot = ankiMediaController.updateNote;
