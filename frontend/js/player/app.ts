import { ankiAllBtn, closeSettingsBtn, controls, deleteVideoBtn, dropzone, fontSizeRange, fullscreenBtn, multiInput, overlay, playPause, progress, settingsBtn, settingsModal, sidebar, subtitleOverlay, targetNoteSelect, timeLabel, toggleBtn, video, videoContainer, videoPickerCancelBtn, videoPickerModal, volume } from "../core/dom.js";
import { getActiveSubtitleEntries, getActiveSubtitles, getCurrentSubtitle, getPrimarySubtitleIndex } from "../subtitles/timing.js";
import { state } from "../core/state.js";
import { addRuntimeKnownBasicWord, ankiRuntimeWordStatusMap, ankiSubtitleHighlighter, checkKnownAnkiWordsStaleOnPlayerOpen, clearRuntimeWordStatuses, collectSubtitleCandidates, ensureStatusesForCandidates, ensureStatusesForSubtitleText, getHighlightWordFieldNames, loadHighlightWordIndexes, refreshKnownAnkiWordFromNote, refreshKnownAnkiWordsFromAnki, rerenderCurrentSubtitleWithAnkiHighlighter } from "../highlighter/anki-highlighter.js";
import { renderSubtitleOverlay } from "../subtitles/subtitles.js";
import { formatTime } from "../subtitles/parsing.js";
import { clearSearchMatches, getCurrentSearchMatch, getSubtitleContextSelection, initSubtitleSidebar, isSubtitleContextDepthDefault, resetSubtitleContextDepths, seekBySubtitle, syncSubtitleStyle } from "../subtitles/subtitles-sidebar.js";
import { findActiveSubtitleIndexAtTime, getAdjustedPlaybackTime } from "./playback-loop.js";
import { createKnownBasicActions } from "./known-basic-actions.js";
import { getJapaneseTokenizer, tokenizeJapaneseText } from "../japanese/japanese-tokenizer.js";
import { apiJson, buildApiUrl } from "../core/api.js";
import { hideAddKnownBasicButton, seekBySeconds, showActionToast, showToast, stepFrame, t, toggleFullscreenMode, updateFullscreenButtonText, updateIconButtons } from "./ui.js";
import { createRuntimePrefetchController } from "./runtime-prefetch.js";
import { bindPlayerShell } from "./shell-bindings.js";
import { handleFiles } from "../video/video.js";
import { createTargetNoteDropdownController } from "./target-note-dropdown.js";
import { i18n } from "../core/i18n.js";
import { createAnkiMediaController, fetchDeckNoteIds, fetchNotesInfo, pickNotePreviewText } from "./anki-actions.js";
import { bindPlayerHotkeys } from "./hotkeys.js";
import { playMedia } from "../video/media-playback.js";
import { focusSubtitleWordSearch, replayCurrentSubtitle } from "../subtitles/sidebar-actions.js";
import { resolveAnkiExportSnapshot } from "./candidate-export.js";
import { candidateExports } from "./candidate-bindings.js";
import { getCurrentVideoPayload } from "../video/media-payload.js";
import { getValidatedVolume } from "../video/audio-preview.js";
import { renderSubtitles } from "../subtitles/sidebar-render.js";
import { loadLibraryEpisodeFromUrl, restoreCurrentVideoFromServer } from "../video/playback-restore.js";
export function hasActiveSubtitleTextSelection(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    return Boolean(
        (anchor && (overlay.contains(anchor) || sidebar.contains(anchor))) ||
        (focus && (overlay.contains(focus) || sidebar.contains(focus)))
    );
}

video.addEventListener("timeupdate", () => {
    const activeSubtitles = getActiveSubtitles();
    const sub = getCurrentSubtitle() || null;
    const isSelectingSubtitleText = hasActiveSubtitleTextSelection();

    if (sub?.text && sub.text !== state.lastRuntimeSubtitleText) {
        state.lastRuntimeSubtitleText = sub.text;

        ensureStatusesForSubtitleText(sub.text).catch((err) => {
            console.warn("Runtime subtitle status lookup failed:", err);
        });
    }

	if (sub) {
		const currentSubtitleIndex = state.subtitles.indexOf(sub);

		if (currentSubtitleIndex !== -1) {
			const windowSize =
				state.runtimePrefetchWindowEnd - state.runtimePrefetchWindowStart + 1;

			const halfPoint =
				state.runtimePrefetchWindowStart + Math.floor(windowSize / 2);

			const shouldPrefetchNextWindow =
				state.runtimePrefetchWindowStart !== -1 &&
				state.runtimePrefetchWindowEnd !== -1 &&
				currentSubtitleIndex >= halfPoint &&
				state.runtimeNextPrefetchStart < state.subtitles.length &&
				!state.runtimePrefetchAllInProgress;

			if (shouldPrefetchNextWindow) {
				console.log(
					`Runtime next window trigger: current=${currentSubtitleIndex}, next=${state.runtimeNextPrefetchStart}`
				);

				prefetchRuntimeStatusesForAllSubtitles({
					silent: true,
					startIndex: state.runtimeNextPrefetchStart
				});
			}
		}
	}

    if (!isSelectingSubtitleText) {
        renderSubtitleOverlay({
            overlay,
            cues: activeSubtitles,
            cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
            highlighter: ankiSubtitleHighlighter
        });
    }

    progress.value = String((video.currentTime / video.duration) * 100 || 0);
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

    if (!video.paused && sub && !isSelectingSubtitleText) {
        const idx = state.subtitles.indexOf(sub);
        syncSubtitleStyle(idx);
    }

	const currentSearchMatch = getCurrentSearchMatch?.();

	if (currentSearchMatch && !video.paused) {
		const currentSubtitleIndex = findActiveSubtitleIndexAtTime(
			state.subtitles,
			getAdjustedPlaybackTime(video, state.globalSubDelay)
		);

		if (
			currentSubtitleIndex !== -1 &&
			currentSubtitleIndex !== currentSearchMatch.subtitleIndex
		) {
			clearSearchMatches?.();
		}
	}

});

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

bindPlayerShell({
    video,
    volume,
    dropzone,
    videoContainer,
    multiInput,
    playPause,
    settingsModal,
    closeSettingsButton: closeSettingsBtn,
    progress,
    controls,
    videoPickerModal,
    videoPickerCancelButton: videoPickerCancelBtn,
    handleFiles,
});

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
bindPlayerHotkeys({
    seekBySeconds,
    seekBySubtitle,
    toggleFullscreen: toggleFullscreenMode,
    stepFrame,
    togglePlayback: () => video.paused ? void playMedia(video) : video.pause(),
    replaySubtitle: replayCurrentSubtitle,
    focusSearch: focusSubtitleWordSearch,
    toggleSubtitles: () => toggleBtn.click(),
});

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

ankiAllBtn.onclick = async () => {
    try {
        await updateCurrentOrSelectedAnkiCard();
	} catch (err) {
	  console.error("Update error:", err);
	  showToast(t("toastError", { message: err.message }), "error", 6000);
	}
};

deleteVideoBtn.onclick = async () => {
    await fetch(buildApiUrl(`/delete-video?filename=${encodeURIComponent(state.currentVideoFile)}`), {
        method: "DELETE"
    });

    location.reload();
};

videoContainer.addEventListener("wheel", (e) => {
    e.preventDefault();

    const direction = e.deltaY > 0 ? -0.05 : 0.05;

    let newVolume = video.volume + direction;
    newVolume = Math.max(0, Math.min(1, newVolume));

    video.volume = newVolume;
    volume.value = String(newVolume);
    volume.dispatchEvent(new Event("input", { bubbles: true }));
    volume.dispatchEvent(new Event("change", { bubbles: true }));

}, { passive: false });

settingsBtn.onclick = (e) => {
    e.stopPropagation();
    settingsModal.classList.remove("hidden");
};

document.addEventListener("click", (e) => {
    if (!settingsModal.contains(e.target as Node) && e.target !== settingsBtn) {
        settingsModal.classList.add("hidden");
    }
});

fontSizeRange.addEventListener("input", (e) => {
    subtitleOverlay.style.fontSize = `${(e.target as HTMLInputElement).value}px`;
});

[
    "subtitleHighlightEnabled",
    "highlightColorNew",
    "highlightColorLearning",
    "highlightColorYoung",
    "highlightColorMature",
    "highlightColorSuspended",
    "highlightColorUnknown",
    "showComprehensionI0",
    "showComprehensionI1",
    "showComprehensionI2",
    "showComprehensionI3",
    "showComprehensionI4",
    "showComprehensionI5Plus"
].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
        renderSubtitleOverlay({
            overlay,
            cues: getActiveSubtitles(),
            cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
            highlighter: ankiSubtitleHighlighter
        });
    });
});

export const globalSubDelayInput = document.getElementById("globalSubDelay");

globalSubDelayInput.addEventListener("input", (e) => {
    state.globalSubDelay = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.lastRuntimeSubtitleText = "";
    state.runtimePrefetchAllRunId += 1;

	renderSubtitles();
	rerenderCurrentSubtitleWithAnkiHighlighter?.();
});

export const ankiUrlInput = document.getElementById("ankiUrl");
export const deckNameInput = document.getElementById("deckName");
export const highlightWordFieldInput = document.getElementById("highlightWordField");
export const highlightDeckNamesInput = document.getElementById("highlightDeckNames");

[ankiUrlInput, deckNameInput].forEach((input) => {
    input?.addEventListener("input", () => {
        clearTimeout(state.deckNoteRefreshTimer);

        state.deckNoteRefreshTimer = setTimeout(() => {
            refreshTargetNoteList({ preserveSelection: true });
        }, 500);
    });
});

[ankiUrlInput, highlightWordFieldInput, highlightDeckNamesInput].forEach((input) => {
    input?.addEventListener("change", () => {
        state.lastRuntimeSubtitleText = "";
        state.runtimePrefetchAllRunId += 1;
		state.runtimeHighlightPrefetchReady = false;
		prefetchRuntimeStatusesForAllSubtitles({ silent: true });

		state.runtimePrefetchWindowStart = -1;
		state.runtimePrefetchWindowEnd = -1;
		state.runtimeNextPrefetchStart = 0;
		state.runtimeHighlightPrefetchReady = false;

		clearRuntimeWordStatuses?.();

        const sub = getCurrentSubtitle();

        if (sub?.text) {
            ensureStatusesForSubtitleText(sub.text).catch((err) => {
                console.warn("Runtime subtitle status lookup failed:", err);
            });
        }

        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
});

targetNoteSelect?.addEventListener("focus", () => {
    refreshTargetNoteList({ preserveSelection: true });
});

fullscreenBtn?.addEventListener("click", () => {
    toggleFullscreenMode();
});

document.addEventListener("fullscreenchange", () => {
    updateFullscreenButtonText();
});

window.addEventListener("load", () => {
    initTargetNoteDropdown();
    refreshTargetNoteList({ preserveSelection: true });
    updateIconButtons();
	initSubtitleSidebar();

	loadLibraryEpisodeFromUrl()
		.then((loadedFromLibrary) => {
			if (!loadedFromLibrary) {
				restoreCurrentVideoFromServer();
			}
		});

    getJapaneseTokenizer?.()
        .then(() => checkKnownAnkiWordsStaleOnPlayerOpen?.({ silent: false }))
        .then(() => loadHighlightWordIndexes?.({ force: true }))
        .then(() => {
            const sub = getCurrentSubtitle?.();

            renderSubtitleOverlay({
                overlay,
                cues: getActiveSubtitles(),
                cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
                highlighter: ankiSubtitleHighlighter
            });

            if (sub?.text) {
                ensureStatusesForSubtitleText(sub.text).catch((err) => {
                    console.warn("Runtime subtitle status lookup failed:", err);
                });
            }
        })
        .catch((err) => {
            console.warn("Japanese tokenizer/known words load failed:", err);
        });
});

export function setAnkiHighlightRefreshStatus(message, kind = "info") {
    const statusEl = document.getElementById("ankiHighlightRefreshStatus");
    if (!statusEl) return;

    statusEl.textContent = message || "";
    statusEl.dataset.status = kind;
}

document.getElementById("refreshAnkiHighlighterBtn")?.addEventListener("click", async () => {
    state.runtimePrefetchAllRunId += 1;

    state.runtimePrefetchWindowStart = -1;
    state.runtimePrefetchWindowEnd = -1;
    state.runtimeNextPrefetchStart = 0;
    state.runtimeHighlightPrefetchReady = false;

    const refreshBtn = document.getElementById("refreshAnkiHighlighterBtn") as HTMLButtonElement | null;
    const oldButtonText = refreshBtn?.textContent || "Refresh Highlight Words";

    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = t("ankiHighlightRefreshButtonRefreshing");
    }
    setAnkiHighlightRefreshStatus(t("ankiHighlightRefreshStatusRefreshing"), "info");

    let result;
    try {
        showToast?.(t("ankiHighlightRefreshStatusRefreshing"), "info", 2500);
        result = await refreshKnownAnkiWordsFromAnki?.();
    } catch (err) {
        const message = err?.message || String(err);
        console.error("Anki highlight refresh failed:", err);
        setAnkiHighlightRefreshStatus(t("ankiHighlightRefreshStatusFailed", { message }), "error");
        showToast?.(t("toastRuntimeHighlighterFailed", { message }), "error", 8000);
        return;
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = oldButtonText.trim() || t("refreshHighlightWords");
        }
    }

    const count = result?.count || 0;
    const cardsChecked = result?.cardsChecked || 0;
    const notesFound = result?.notesFound || result?.notesChecked || 0;
    const importedWords = result?.importedWords || 0;
    const preservedLockedWords = result?.preservedLockedWords || 0;
    const message = t("ankiHighlightRefreshStatusDone", { count, notesFound, cardsChecked, importedWords, preservedLockedWords });

    setAnkiHighlightRefreshStatus(message, "success");
    showToast?.(t("ankiHighlightRefreshToastDone", { count }), "success", 5000);

    const sub = getCurrentSubtitle?.();

    if (sub?.text) {
        ensureStatusesForSubtitleText(sub.text).catch((err) => {
            const message = err?.message || String(err);
            console.error("Snapshot highlighter failed:", err);
            setAnkiHighlightRefreshStatus(t("ankiHighlightRefreshStatusRepaintFailed", { message }), "error");
            showToast?.(t("toastRuntimeHighlighterFailed", { message }), "error", 6000);
        });
    }

    prefetchRuntimeStatusesForAllSubtitles({ silent: true });
});
