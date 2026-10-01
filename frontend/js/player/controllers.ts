import { createKnownBasicActions } from "./known-basic-actions.js";

import { getJapaneseTokenizer,tokenizeJapaneseText } from "../japanese/japanese-tokenizer.js";

import { apiJson } from "../core/api.js";

import { t } from "../core/translate.js";
import { hideAddKnownBasicButton,showActionToast,showToast } from "./ui.js";

import { addRuntimeKnownBasicWord,ankiRuntimeWordStatusMap } from "../highlighter/word-status-store.js";

import { getCurrentSubtitle,getPrimarySubtitleIndex } from "../subtitles/timing.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { overlay,targetNoteSelect,video } from "../core/dom.js";

import { ankiSubtitleHighlighter,collectSubtitleCandidates,ensureStatusesForCandidates,ensureStatusesForSubtitleText,rerenderCurrentSubtitleWithAnkiHighlighter } from "../highlighter/anki-highlighter.js";

import { createRuntimePrefetchController } from "./runtime-prefetch.js";

import { state } from "../core/state.js";

import { getHighlightWordFieldNames,loadHighlightWordIndexes,refreshKnownAnkiWordFromNote } from "../highlighter/word-index-sync.js";

import { createTargetNoteDropdownController } from "./target-note-dropdown.js";

import { i18n } from "../core/i18n.js";

import { fetchDeckNoteIds,fetchNotesInfo } from "../anki/notes.js";

import { pickNotePreviewText } from "../anki/note-fields.js";

import { getSubtitleContextSelection,isSubtitleContextDepthDefault,resetSubtitleContextDepths } from "../subtitles/context-range.js";

import { createAnkiMediaController } from "./anki-actions.js";

import { resolveAnkiExportSnapshot } from "./candidate-export.js";

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
    copyText: (text) => navigator.clipboard.writeText(text),
});

export const addWordToKnownBasic = knownBasicActions.addWord;

export const copyWordForYomitan = knownBasicActions.copyWord;

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

export const targetNoteDropdown = createTargetNoteDropdownController({
    select: targetNoteSelect,
    getAnkiUrl: () => (document.getElementById("ankiUrl") as HTMLInputElement).value,
    getDeckName: () => (document.getElementById("deckName") as HTMLInputElement).value,
    getLastAddedLabel: () => i18n[state.currentLang].dict.lastAdded || "🕘",
    getLastAddedTitle: () => i18n[state.currentLang].dict.lastAddedTitle || "Last added card",
    fetchDeckNoteIds,
    fetchNotesInfo,
    pickNotePreviewText
});

export const refreshTargetNoteList = targetNoteDropdown.refresh;

export const initTargetNoteDropdown = targetNoteDropdown.init;

export function maybePromptSubtitleDepthReset() {
    if (isSubtitleContextDepthDefault()) return;

    showActionToast(
        t("toastResetSubtitleDepthQuestion"),
        [
            {
                label: t("toastResetSubtitleDepthYes"),
                onClick: () => {
                    resetSubtitleContextDepths();
                }
            },
            {
                label: t("toastResetSubtitleDepthNo")
            }
        ],
        "info",
        0
    );
}

export function getActiveSubtitleIndex() {
    return getPrimarySubtitleIndex();
}

export const ankiMediaController = createAnkiMediaController({
    resolveExportSnapshot: () => resolveAnkiExportSnapshot(),
    validateExportSnapshot: (snapshot) => candidateExports.validate(snapshot),
    translate: t,
    getVideoPayload: getCurrentVideoPayload,
    getVideoCurrentTime: () => video.currentTime,
    getValidatedVolume,
    getActiveSubtitleIndex,
    getSubtitleStart: (index) => state.subtitles[index].start,
    getSubtitleContext: getSubtitleContextSelection,
    getGlobalSubtitleDelay: () => state.globalSubDelay,
    getTargetNoteId: () => Number(targetNoteSelect?.value || 0),
    clearTargetNote: () => {
        if (targetNoteSelect) targetNoteSelect.value = "";
    },
    refreshTargetNotes: () => refreshTargetNoteList({ preserveSelection: false }),
    maybePromptSubtitleDepthReset,
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
    },
    showToast
});

export const buildCurrentAnkiMediaSnapshot = ankiMediaController.buildSnapshot;

export const updateAnkiNoteWithSnapshot = ankiMediaController.updateNote;

export const updateCurrentOrSelectedAnkiCard = ankiMediaController.updateCurrentOrSelected;
