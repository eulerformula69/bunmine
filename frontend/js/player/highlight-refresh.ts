import { state } from "../core/state.js";
import { reportError } from "./toast.js";

import { t } from "../core/translate.js";
import { showToast } from "./ui.js";

import { refreshKnownAnkiWordsFromAnki } from "../highlighter/word-index-sync.js";

import { getCurrentSubtitle } from "../subtitles/timing.js";

import { ensureStatusesForSubtitleText } from "../highlighter/anki-highlighter.js";

import { prefetchRuntimeStatusesForAllSubtitles } from "./controllers.js";

export function setAnkiHighlightRefreshStatus(message: string, kind = "info") {
    const statusEl = document.getElementById("ankiHighlightRefreshStatus");
    if (!statusEl) return;

    statusEl.textContent = message || "";
    statusEl.dataset.status = kind;
}

export async function refreshHighlightWords() {
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
        reportError(err, {key: "toastRuntimeHighlighterFailed", duration: 8000,
            log: "Anki highlight refresh failed:",
            status: message => setAnkiHighlightRefreshStatus(t("ankiHighlightRefreshStatusFailed", {message}), "error")});
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
            reportError(err, {key: "toastRuntimeHighlighterFailed", log: "Snapshot highlighter failed:",
                status: message => setAnkiHighlightRefreshStatus(t("ankiHighlightRefreshStatusRepaintFailed", {message}), "error")});
        });
    }

    prefetchRuntimeStatusesForAllSubtitles({ silent: true });
}
