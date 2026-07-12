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
    audioTrackSelect,
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


video.volume = Number(volume.value);

volume.addEventListener("input", () => {
    const nextVolume = Math.max(0, Math.min(1, parseFloat(volume.value) || 0));
    video.volume = nextVolume;
    if (typeof audioManager !== "undefined" && audioManager.externalAudio) {
        audioManager.externalAudio.volume = nextVolume;
    }
});

video.addEventListener("timeupdate", () => {
    const sub = getCurrentSubtitle();

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
        text: sub ? sub.text : "",
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

async function getKnownBasicDictionaryForm(rawWord) {
    const selected = String(rawWord || "").trim();

    if (!selected) return "";

    if (typeof tokenizeJapaneseText !== "function") {
        console.warn("tokenizeJapaneseText is not available");
        return selected;
    }

    try {
        const tokens = await tokenizeJapaneseText(selected);

        if (!Array.isArray(tokens) || !tokens.length) {
            return selected;
        }

        const meaningfulTokens = tokens.filter((token) => {
            const surface = String(token.surface_form || "").trim();

            if (!surface) return false;

            const pos = String(token.pos || "");
            return !["иЁеЏ·", "еЉ©и©ћ", "еЉ©е‹•и©ћ"].includes(pos);
        });

        if (!meaningfulTokens.length) {
            return selected;
        }

        // РќРѕСЂРјР°Р»РёР·СѓРµРј С‚РѕР»СЊРєРѕ РµСЃР»Рё РІС‹РґРµР»РµРЅРёРµ вЂ” РѕРґРёРЅ РіР»Р°РіРѕР»:
        // йЈџгЃ№гЃџ -> йЈџгЃ№г‚‹
        // и¦‹гЃѕгЃ—гЃџ -> и¦‹г‚‹
        if (meaningfulTokens.length === 1) {
            const token = meaningfulTokens[0];
            const pos = String(token.pos || "");

            if (pos === "е‹•и©ћ") {
                const basic = String(token.basic_form || "").trim();

                if (basic && basic !== "*") {
                    return basic;
                }
            }
        }

        // Р’СЃС‘ РѕСЃС‚Р°Р»СЊРЅРѕРµ СЃРѕС…СЂР°РЅСЏРµРј РєР°Рє РІС‹РґРµР»РµРЅРѕ
        return selected;
    } catch (err) {
        console.warn("Known-basic dictionary form lookup failed:", err);
        return selected;
    }
}

async function addWordToKnownBasic(word) {
    const originalWord = String(word || "").trim();
    const cleanWord = await getKnownBasicDictionaryForm(originalWord);

		if (!cleanWord) {
			showToast(t("toastNoWordSelected"), "error", 3000);
			return;
		}

    try {
        const { response, data } = await apiJson("/known-basic-words/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                word: cleanWord
            })
        });

        if (!response.ok || data.error) {
            throw new Error(String(data.error || "Could not add word"));
        }

        markKnownBasicWordAsMature(cleanWord);

        window.getSelection()?.removeAllRanges();
        hideAddKnownBasicButton();

        if (data.added) {
			if (originalWord && originalWord !== cleanWord) {
				showToast(`Added to known-basic: ${originalWord} в†’ ${cleanWord}`, "success", 3000);
			} else {
				showToast(`Added to known-basic: ${cleanWord}`, "success", 3000);
			}
        } else {
            showToast(t("toastKnownBasicAlreadyExists", { word: cleanWord }), "info", 3000);
        }

    } catch (err) {
        console.error("Known-basic add failed:", err);
        showToast(t("toastKnownBasicAddFailed", { message: err.message }), "error", 6000);
    }
}

async function copyWordForYomitan(word) {
    const cleanWord = String(word || "").trim();

    if (!cleanWord) {
        showToast(t("toastCopiedForYomitan", { word: cleanWord }), "success", 3000);
        return;
    }

    try {
        await navigator.clipboard.writeText(cleanWord);
        showToast(`Copied for Yomitan: ${cleanWord}`, "success", 3000);
    } catch (err) {
        console.error("Copy for Yomitan failed:", err);
        showToast(t("toastCopyFailed", { message: err.message }), "error", 5000);
    }
}

function markKnownBasicWordAsMature(word) {
    if (typeof addRuntimeKnownBasicWord === "function") {
        addRuntimeKnownBasicWord(word);
    }

    const sub = getCurrentSubtitle?.();

    renderSubtitleOverlay({
        overlay,
        text: sub ? sub.text : "",
        highlighter: ankiSubtitleHighlighter
    });
}

async function prefetchRuntimeStatusesForAllSubtitles({
    silent = true,
    startIndex = null
} = {}) {
    if (!Array.isArray(subtitles) || !subtitles.length) return;
    if (runtimePrefetchAllInProgress) return;

    const runId = ++runtimePrefetchAllRunId;
    runtimePrefetchAllInProgress = true;
    runtimeHighlightPrefetchReady = false;

    const chunkSize = 100;
    const chunkDelayMs = 50;
    const subtitleWindowSize = 20;

    try {
        await loadHighlightWordIndexes?.();

        if (typeof getJapaneseTokenizer === "function") {
            await getJapaneseTokenizer();
        }

        let currentIdx = Number.isInteger(startIndex)
            ? startIndex
            : subtitles.indexOf(getCurrentSubtitle?.());

        if (currentIdx < 0) currentIdx = 0;

        const startIdx = Math.max(0, currentIdx);
        const endIdx = Math.min(
            subtitles.length - 1,
            startIdx + subtitleWindowSize - 1
        );

        runtimePrefetchWindowStart = startIdx;
        runtimePrefetchWindowEnd = endIdx;
        runtimeNextPrefetchStart = endIdx + 1;

        const subtitlesToPrefetch = subtitles.slice(startIdx, endIdx + 1);

        console.log(
            `Runtime window prefetch: subtitles ${startIdx}-${endIdx} / ${subtitles.length}`
        );

        const allCandidates = new Set<string>();

        for (let i = 0; i < subtitlesToPrefetch.length; i += 1) {
            if (runId !== runtimePrefetchAllRunId) return;

            const text = subtitlesToPrefetch[i]?.text;
            if (!text) continue;

            const candidates = collectSubtitleCandidates(text);

            for (const candidate of candidates) {
                if (!ankiRuntimeWordStatusMap.has(candidate)) {
                    allCandidates.add(candidate);
                }
            }
        }

        const candidates = [...allCandidates];

        console.log(`Runtime batch prefetch started: ${candidates.length} candidates`);

        for (let i = 0; i < candidates.length; i += chunkSize) {
            if (runId !== runtimePrefetchAllRunId) return;

            const chunk = candidates.slice(i, i + chunkSize);

            console.log(
                `Runtime batch prefetch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(candidates.length / chunkSize)}: ${chunk.length}`
            );

            await ensureStatusesForCandidates(chunk, { silent: true });

            await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
        }

        if (runId === runtimePrefetchAllRunId) {
            runtimeHighlightPrefetchReady = true;
            console.log("Runtime window prefetch finished");
            rerenderCurrentSubtitleWithAnkiHighlighter?.();
        }
    } catch (err) {
        console.warn("Runtime batch prefetch failed:", err);
    } finally {
        if (runId === runtimePrefetchAllRunId) {
            runtimePrefetchAllInProgress = false;
        }
    }
}

[dropzone, videoContainer].forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.style.cursor = "pointer";
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    });
});


document.getElementById("clickToUpload").onclick = () => multiInput.click();
multiInput.addEventListener("change", (e) => handleFiles((e.target as HTMLInputElement).files));

dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
});
dropzone.addEventListener("dragover", (e) => e.preventDefault());

playPause.onclick = (e) => {
    e.stopPropagation();

    if (video.paused) video.play();
    else video.pause();
};

video.onclick = () => {
    if (video.paused) video.play();
    else video.pause();
};

closeSettingsBtn.onclick = () => {
    settingsModal.classList.add("hidden");
};

settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add("hidden");
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        settingsModal.classList.add("hidden");
    }
});

document.querySelectorAll<HTMLElement>(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        const targetTab = tab.dataset.settingsTab;

        document.querySelectorAll(".settings-tab").forEach((item) => {
            item.classList.toggle("active", item === tab);
        });

        document.querySelectorAll<HTMLElement>(".settings-page").forEach((page) => {
            page.classList.toggle(
                "active",
                page.dataset.settingsPage === targetTab
            );
        });
    });
});

progress.oninput = () => {
    video.currentTime = (Number(progress.value) / 100) * video.duration;
    audioManager.sync();
};

videoContainer.addEventListener("mousemove", (e) => {
    const rect = videoContainer.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isBottom = relativeY >= rect.height - 120;

    controls.style.opacity = isBottom ? "1" : "0";
    controls.style.pointerEvents = isBottom ? "auto" : "none";
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
document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (e.code === "ArrowLeft") {
        e.preventDefault();

        if (e.shiftKey) {
            seekBySeconds(-5);
            return;
        }

        seekBySubtitle(-1);
    }

    if (e.code === "ArrowRight") {
        e.preventDefault();

        if (e.shiftKey) {
            seekBySeconds(5);
            return;
        }

        seekBySubtitle(1);
    }
});

document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreenMode();
        return;
    }

    if (e.code === "Comma") {
        e.preventDefault();
        stepFrame(-1);
        return;
    }

    if (e.code === "Period") {
        e.preventDefault();
        stepFrame(1);
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }

        return;
    }

    if (e.code === "KeyR") {
        e.preventDefault();
        replayCurrentSubtitle();
        return;
    }

    if (e.code === "Slash") {
        e.preventDefault();
        focusSubtitleWordSearch();
        return;
    }

    if (e.code === "KeyS") {
        e.preventDefault();
        toggleBtn.click();
    }
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
    return findActiveSubtitleIndexAtTime(
        subtitles,
        getAdjustedPlaybackTime(video, globalSubDelay)
    );
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
        return getActiveSubtitleIndex();
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
    getAudioTrackValue: () => audioTrackSelect.value,
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

    if (audioManager.externalAudio) audioManager.externalAudio.volume = newVolume;
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
        const sub = getCurrentSubtitle();

        renderSubtitleOverlay({
            overlay,
            text: sub ? sub.text : "",
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
                text: sub ? sub.text : "",
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

document.addEventListener("visibilitychange", () => {
    if (document.hidden && !video.paused) {
        video.play().catch(() => {});

        if (audioManager.externalAudio) {
            audioManager.externalAudio.play().catch(() => {});
        }
    }
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

videoPickerCancelBtn?.addEventListener("click", () => {
    videoPickerModal?.classList.add("hidden");
    dropzone.classList.remove("hidden");
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
