import { logger } from "../core/logger.js";
import { deleteVideoBtn,fontSizeRange,fullscreenBtn,overlay,settingsBtn,settingsModal,subtitleOverlay,video,videoContainer,volume } from "../core/dom.js";

import { prefetchRuntimeStatusesForAllSubtitles } from "./controllers.js";

import { toggleFullscreenMode,updateFullscreenButtonText } from "./ui.js";

import { buildApiUrl } from "../core/api.js";

import { state } from "../core/state.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { getActiveSubtitleEntries,getActiveSubtitles,getCurrentSubtitle } from "../subtitles/timing.js";

import { ankiSubtitleHighlighter,ensureStatusesForSubtitleText,rerenderCurrentSubtitleWithAnkiHighlighter } from "../highlighter/anki-highlighter.js";

import { renderSubtitles } from "../subtitles/sidebar-render.js";

import { clearRuntimeWordStatuses } from "../highlighter/word-status-store.js";

export function bindPlayerEvents() {
deleteVideoBtn.onclick = async () => {
    if (!state.currentVideoFile) return;
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
    "subtitleAnnotationsVisible",
    "highlightColorNew",
    "highlightColorLearning",
    "highlightColorYoung",
    "highlightColorMature",
    "highlightColorSuspended",
    "highlightColorUnknown",
    "subtitleComprehensionMinimum"
].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
        if (id === "subtitleAnnotationsVisible") {
            state.subtitleSearchMatches = [];
            state.subtitleSearchIndex = -1;
            renderSubtitles();
        }
        renderSubtitleOverlay({
            overlay,
            cues: getActiveSubtitles(),
            cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
            highlighter: ankiSubtitleHighlighter
        });
    });
});

const globalSubDelayInput = document.getElementById("globalSubDelay");

globalSubDelayInput?.addEventListener("input", (e) => {
    state.globalSubDelay = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.lastRuntimeSubtitleText = "";
    state.runtimePrefetchAllRunId += 1;

	renderSubtitles();
	rerenderCurrentSubtitleWithAnkiHighlighter?.();
});

const ankiUrlInput = document.getElementById("ankiUrl");

const highlightWordFieldInput = document.getElementById("highlightWordField");

const highlightDeckNamesInput = document.getElementById("highlightDeckNames");

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
                logger.warn("Runtime subtitle status lookup failed:", err);
            });
        }

        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
});

fullscreenBtn?.addEventListener("click", () => {
    toggleFullscreenMode();
});

document.addEventListener("fullscreenchange", () => {
    updateFullscreenButtonText();
});

}
