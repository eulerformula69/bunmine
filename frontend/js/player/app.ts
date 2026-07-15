const {
    video,
    sidebar,
    multiInput,
    fullscreenBtn,
    settingsBtn,
    settingsModal,
    closeSettingsBtn,
    dropzone,
    toggleBtn,
    overlay,
    deleteVideoBtn,
    playPause,
    progress,
    timeLabel,
    videoContainer,
    controls,
    ankiAllBtn,
    targetNoteSelect,
    fontSizeRange,
    subtitleOverlay,
    resizer,
    videoPickerModal,
    videoPickerList,
    videoPickerCancelBtn,
    addKnownBasicBtn,
    addCardToDeck,
    volume
} = playerContext.dom as Required<PlayerDom>;


video.addEventListener("timeupdate", () => {
    const activeSubtitles = getActiveSubtitles();
    const sub = getCurrentSubtitle() || null;

    if (sub?.text && sub.text !== lastRuntimeSubtitleText) {
        lastRuntimeSubtitleText = sub.text;

        ensureStatusesForSubtitleText(sub.text).catch((err) => {
            console.warn("Runtime subtitle status lookup failed:", err);
        });
    }

	if (sub) {
		const currentSubtitleIndex = subtitles.indexOf(sub);

		if (currentSubtitleIndex !== -1) {
			const windowSize =
				runtimePrefetchWindowEnd - runtimePrefetchWindowStart + 1;

			const halfPoint =
				runtimePrefetchWindowStart + Math.floor(windowSize / 2);

			const shouldPrefetchNextWindow =
				runtimePrefetchWindowStart !== -1 &&
				runtimePrefetchWindowEnd !== -1 &&
				currentSubtitleIndex >= halfPoint &&
				runtimeNextPrefetchStart < subtitles.length &&
				!runtimePrefetchAllInProgress;

			if (shouldPrefetchNextWindow) {
				console.log(
					`Runtime next window trigger: current=${currentSubtitleIndex}, next=${runtimeNextPrefetchStart}`
				);

				prefetchRuntimeStatusesForAllSubtitles({
					silent: true,
					startIndex: runtimeNextPrefetchStart
				});
			}
		}
	}

    renderSubtitleOverlay({
        overlay,
        cues: activeSubtitles,
        cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
        highlighter: ankiSubtitleHighlighter
    });

    progress.value = String((video.currentTime / video.duration) * 100 || 0);
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

    if (!video.paused && sub) {
        const idx = subtitles.indexOf(sub);
        syncSubtitleStyle(idx);
    }

	const currentSearchMatch = getCurrentSearchMatch?.();

	if (currentSearchMatch && !video.paused) {
		const currentSubtitleIndex = findActiveSubtitleIndexAtTime(
			subtitles,
			getAdjustedPlaybackTime(video, globalSubDelay)
		);

		if (
			currentSubtitleIndex !== -1 &&
			currentSubtitleIndex !== currentSearchMatch.subtitleIndex
		) {
			clearSearchMatches?.();
		}
	}
	
});

const knownBasicActions = createKnownBasicActions({
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
const addWordToKnownBasic = knownBasicActions.addWord;
const copyWordForYomitan = knownBasicActions.copyWord;

const runtimePrefetchController = createRuntimePrefetchController({
    state: window.BunmineState,
    getSubtitles: () => subtitles,
    getCurrentSubtitle: () => getCurrentSubtitle?.(),
    loadWordIndexes: () => loadHighlightWordIndexes?.() || Promise.resolve(),
    loadTokenizer: () => typeof getJapaneseTokenizer === "function"
        ? getJapaneseTokenizer()
        : Promise.resolve(),
    collectCandidates: collectSubtitleCandidates,
    hasStatus: (candidate) => ankiRuntimeWordStatusMap.has(candidate),
    ensureStatuses: ensureStatusesForCandidates,
    rerender: () => rerenderCurrentSubtitleWithAnkiHighlighter?.(),
});
async function prefetchRuntimeStatusesForAllSubtitles(options = {}) {
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

const targetNoteDropdown = createTargetNoteDropdownController({
    select: targetNoteSelect,
    getAnkiUrl: () => (document.getElementById("ankiUrl") as HTMLInputElement).value,
    getDeckName: () => (document.getElementById("deckName") as HTMLInputElement).value,
    getLastAddedLabel: () => i18n[currentLang].dict.lastAdded || "🕘",
    getLastAddedTitle: () => i18n[currentLang].dict.lastAddedTitle || "Last added card",
    fetchDeckNoteIds,
    fetchNotesInfo,
    pickNotePreviewText
});

const refreshTargetNoteList = targetNoteDropdown.refresh;
const initTargetNoteDropdown = targetNoteDropdown.init;
bindPlayerHotkeys({
    seekBySeconds,
    seekBySubtitle,
    toggleFullscreen: toggleFullscreenMode,
    stepFrame,
    togglePlayback: () => video.paused ? video.play() : video.pause(),
    replaySubtitle: replayCurrentSubtitle,
    focusSearch: focusSubtitleWordSearch,
    toggleSubtitles: () => toggleBtn.click(),
});

function maybePromptSubtitleDepthReset() {
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

function getActiveSubtitleIndex() {
    return getPrimarySubtitleIndex();
}

function getSubtitleIndexFromSelection(selection = window.getSelection()) {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return -1;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode as Element | null;
    const focusElement = focusNode?.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : focusNode as Element | null;

    const sidebarSubtitle = anchorElement?.closest?.(".subtitle[data-index]")
        || focusElement?.closest?.(".subtitle[data-index]");

    if (sidebarSubtitle) {
        const idx = Number((sidebarSubtitle as HTMLElement).dataset.index);
        return Number.isInteger(idx) ? idx : -1;
    }

    if (overlay?.contains(anchorElement) || overlay?.contains(focusElement)) {
        const overlaySubtitle = anchorElement?.closest?.(".subtitle-overlay-line[data-subtitle-index]")
            || focusElement?.closest?.(".subtitle-overlay-line[data-subtitle-index]");
        const index = Number((overlaySubtitle as HTMLElement | null)?.dataset.subtitleIndex);
        return Number.isInteger(index) ? index : getActiveSubtitleIndex();
    }

    return -1;
}

const ankiMediaController = createAnkiMediaController({
    translate: t,
    getVideoPayload: getCurrentVideoPayload,
    getVideoCurrentTime: () => video.currentTime,
    getValidatedVolume,
    getActiveSubtitleIndex,
    getSubtitleStart: (index) => subtitles[index].start,
    getSubtitleContext: getSubtitleContextSelection,
    getGlobalSubtitleDelay: () => globalSubDelay,
    getTargetNoteId: () => Number(targetNoteSelect?.value || 0),
    clearTargetNote: () => {
        if (targetNoteSelect) targetNoteSelect.value = "";
    },
    refreshTargetNotes: () => refreshTargetNoteList({ preserveSelection: false }),
    maybePromptSubtitleDepthReset,
    resetRuntimeHighlightPrefetch: () => {
        runtimePrefetchWindowStart = -1;
        runtimePrefetchWindowEnd = -1;
        runtimeNextPrefetchStart = 0;
        runtimeHighlightPrefetchReady = false;
    },
    refreshKnownWord: (payload) => refreshKnownAnkiWordFromNote?.(payload),
    getHighlightWordFields: () => getHighlightWordFieldNames?.(),
    ensureSubtitleStatuses: ensureStatusesForSubtitleText,
    prefetchSubtitleStatuses: () => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    },
    showToast
});

const buildCurrentAnkiMediaSnapshot = ankiMediaController.buildSnapshot;
const updateAnkiNoteWithSnapshot = ankiMediaController.updateNote;
const updateCurrentOrSelectedAnkiCard = ankiMediaController.updateCurrentOrSelected;

function isAutoAttachNextCardEnabled() {
    return (document.getElementById("autoAttachNextCardEnabled") as HTMLInputElement | null)?.checked === true;
}

const autoAttachQueueController = createAutoAttachQueueController({
    translate: t,
    getSelectedText: getCleanSelectedText,
    buildSnapshot: buildCurrentAnkiMediaSnapshot,
    fetchDeckNoteIds,
    fetchNoteIdsByQuery,
    fetchNotesInfo,
    stripHtml,
    sleep,
    copyWord: copyWordForYomitan,
    updateNote: updateAnkiNoteWithSnapshot,
    refreshTargetNotes: () => refreshTargetNoteList({ preserveSelection: false }),
    maybePromptSubtitleDepthReset,
    showToast,
    showActionToast,
    isEnabled: isAutoAttachNextCardEnabled
});

async function copyWordAndAttachNextCard(word) {
    await autoAttachQueueController.start(word, {
        copyWord: true,
        subtitleIndex: getSubtitleIndexFromSelection()
    });
}

function armAutoAttachForSelection(word, subtitleIndex) {
    if (!word || !Number.isInteger(subtitleIndex) || subtitleIndex < 0) return;
    autoAttachQueueController.armForSelection(word, subtitleIndex);
}

const scheduleAutoAttachCancelIfSelectionCleared =
    autoAttachQueueController.scheduleCancelIfSelectionCleared;
const clearAutoAttachSelectionCancelTimer =
    autoAttachQueueController.clearSelectionCancelTimer;

ankiAllBtn.onclick = async () => {
    try {
        await updateCurrentOrSelectedAnkiCard();
	} catch (err) {
	  console.error("Update error:", err);
	  showToast(t("toastError", { message: err.message }), "error", 6000);
	}
};

deleteVideoBtn.onclick = async () => {
    await fetch(buildApiUrl(`/delete-video?filename=${encodeURIComponent(currentVideoFile)}`), {
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

const globalSubDelayInput = document.getElementById("globalSubDelay");

globalSubDelayInput.addEventListener("input", (e) => {
    globalSubDelay = parseFloat((e.target as HTMLInputElement).value) || 0;
    lastRuntimeSubtitleText = "";
    runtimePrefetchAllRunId += 1;

	renderSubtitles();
	rerenderCurrentSubtitleWithAnkiHighlighter?.();
});

const ankiUrlInput = document.getElementById("ankiUrl");
const deckNameInput = document.getElementById("deckName");
const highlightWordFieldInput = document.getElementById("highlightWordField");
const highlightDeckNamesInput = document.getElementById("highlightDeckNames");

[ankiUrlInput, deckNameInput].forEach((input) => {
    input?.addEventListener("input", () => {
        clearTimeout(deckNoteRefreshTimer);

        deckNoteRefreshTimer = setTimeout(() => {
            refreshTargetNoteList({ preserveSelection: true });
        }, 500);
    });
});

[ankiUrlInput, highlightWordFieldInput, highlightDeckNamesInput].forEach((input) => {
    input?.addEventListener("change", () => {
        lastRuntimeSubtitleText = "";
        runtimePrefetchAllRunId += 1;
		runtimeHighlightPrefetchReady = false;
		prefetchRuntimeStatusesForAllSubtitles({ silent: true });

		runtimePrefetchWindowStart = -1;
		runtimePrefetchWindowEnd = -1;
		runtimeNextPrefetchStart = 0;
		runtimeHighlightPrefetchReady = false;

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

document.getElementById("autoAttachNextCardEnabled")?.addEventListener("change", (event) => {
    showToast(
        (event.target as HTMLInputElement).checked
            ? t("toastAutoAttachEnabled")
            : t("toastAutoAttachDisabled"),
        "info",
        3000
    );
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

function setAnkiHighlightRefreshStatus(message, kind = "info") {
    const statusEl = document.getElementById("ankiHighlightRefreshStatus");
    if (!statusEl) return;

    statusEl.textContent = message || "";
    statusEl.dataset.status = kind;
}

document.getElementById("refreshAnkiHighlighterBtn")?.addEventListener("click", async () => {
    runtimePrefetchAllRunId += 1;

    runtimePrefetchWindowStart = -1;
    runtimePrefetchWindowEnd = -1;
    runtimeNextPrefetchStart = 0;
    runtimeHighlightPrefetchReady = false;

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

addKnownBasicBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
});

addKnownBasicBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await addWordToKnownBasic(selectedKnownBasicWord);
});

let addCardToDeckPointerHandled = false;

async function handleAddCardToDeckAction(e) {
    e.preventDefault();
    e.stopPropagation();

    const selectedWord = String(selectedKnownBasicWord || getCleanSelectedText() || "").trim();
    const autoAttachEnabled = isAutoAttachNextCardEnabled();

    if (autoAttachEnabled) {
        await copyWordAndAttachNextCard(selectedWord);
        return;
    }

    await copyWordForYomitan(selectedWord);
}

addCardToDeck?.addEventListener("pointerdown", async (e) => {
    addCardToDeckPointerHandled = true;
    await handleAddCardToDeckAction(e);
});

addCardToDeck?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

addCardToDeck?.addEventListener("click", async (e) => {
    if (addCardToDeckPointerHandled) {
        addCardToDeckPointerHandled = false;
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    await handleAddCardToDeckAction(e);
});

document.addEventListener("mousedown", (e) => {
    if (
        addKnownBasicBtn?.contains(e.target as Node) ||
        addCardToDeck?.contains(e.target as Node)
    ) {
        return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
        scheduleAutoAttachCancelIfSelectionCleared();
        hideAddKnownBasicButton();
    }
});

document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        scheduleAutoAttachCancelIfSelectionCleared();
        hideAddKnownBasicButton();
        return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode;

    const focusElement = focusNode?.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : focusNode;

    const isSubtitleSelection =
        overlay?.contains(anchorElement) ||
        overlay?.contains(focusElement);

    if (!isSubtitleSelection) {
        scheduleAutoAttachCancelIfSelectionCleared();
        hideAddKnownBasicButton();
        return;
    }

    clearAutoAttachSelectionCancelTimer();

    requestAnimationFrame(() => {
        showAddKnownBasicButtonForSelection();
    });
});
