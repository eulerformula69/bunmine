import { logger } from "../core/logger.js";
import { LibraryProgressPayload } from "../types/runtime-types.js";
import { video } from "../core/dom.js";

import { state } from "../core/state.js";

import { t } from "../core/translate.js";
import { showActionToast,showToast } from "../player/ui.js";

import { apiJson,buildApiUrl,getApiErrorMessage } from "../core/api.js";

export const LIBRARY_AUTO_COMPLETE_MIN_WATCHED_RATIO = 0.75;

export const LIBRARY_AUTO_COMPLETE_POSITION_RATIO = 0.92;

export const LIBRARY_AUTO_COMPLETE_ENDING_RATIO = 0.05;

export const LIBRARY_AUTO_COMPLETE_ENDING_MAX_SECONDS = 90;

export const libraryProgressLastSentAtMsState = { value: 0 };

export const libraryProgressLastVideoTimeState = { value: 0 };

export const libraryProgressSaveInFlightState = { value: false };

export const libraryAutoCompletePromptEpisodeIdState: { value: string | number | null } = { value: null };

export const libraryAutoCompleteDismissedEpisodeIdState: { value: string | number | null } = { value: null };

export function resetLibraryProgressTracking() {
    libraryProgressLastSentAtMsState.value = 0;
    libraryProgressLastVideoTimeState.value = Number.isFinite(video.currentTime)
        ? video.currentTime
        : 0;
    libraryAutoCompletePromptEpisodeIdState.value = null;
    libraryAutoCompleteDismissedEpisodeIdState.value = null;
}

export function getLibraryWatchedDeltaSeconds(currentTime: number) {
    const previousTime = Number(libraryProgressLastVideoTimeState.value || 0);
    const delta = currentTime - previousTime;

    libraryProgressLastVideoTimeState.value = currentTime;

    // РЎС‡РёС‚Р°РµРј С‚РѕР»СЊРєРѕ РѕР±С‹С‡РЅРѕРµ РґРІРёР¶РµРЅРёРµ РІРїРµСЂС‘Рґ.
    // РџРµСЂРµРјРѕС‚РєРё Рё Р±РѕР»СЊС€РёРµ СЃРєР°С‡РєРё РЅРµ СЃС‡РёС‚Р°РµРј РєР°Рє РїСЂРѕСЃРјРѕС‚СЂ.
    if (delta <= 0 || delta > 15) {
        return 0;
    }

    return delta;
}

export function shouldPromptLibraryAutoComplete(progress: LibraryProgressPayload["progress"]) {
    if (!state.currentLibraryEpisodeId || !progress) return false;
    if (progress.completed) return false;
    if (libraryAutoCompletePromptEpisodeIdState.value === state.currentLibraryEpisodeId) return false;
    if (libraryAutoCompleteDismissedEpisodeIdState.value === state.currentLibraryEpisodeId) return false;

    const duration = Number(progress.duration_seconds ?? video.duration ?? 0);
    const currentTime = Number(progress.current_time_seconds ?? video.currentTime ?? 0);
    const watchedSeconds = Number(progress.watched_seconds ?? 0);

    if (!Number.isFinite(duration) || duration <= 0) return false;
    if (!Number.isFinite(currentTime) || currentTime <= 0) return false;
    if (!Number.isFinite(watchedSeconds) || watchedSeconds <= 0) return false;

    const watchedRatio = watchedSeconds / duration;
    const positionRatio = currentTime / duration;
    const remainingSeconds = Math.max(0, duration - currentTime);
    const endingThresholdSeconds = Math.min(
        LIBRARY_AUTO_COMPLETE_ENDING_MAX_SECONDS,
        duration * LIBRARY_AUTO_COMPLETE_ENDING_RATIO
    );

    const watchedEnough = watchedRatio >= LIBRARY_AUTO_COMPLETE_MIN_WATCHED_RATIO;
    const nearEnd =
        positionRatio >= LIBRARY_AUTO_COMPLETE_POSITION_RATIO ||
        remainingSeconds <= endingThresholdSeconds;

    return watchedEnough && nearEnd;
}

export function maybePromptLibraryAutoComplete(progress: LibraryProgressPayload["progress"]) {
    if (!shouldPromptLibraryAutoComplete(progress)) return;

    libraryAutoCompletePromptEpisodeIdState.value = state.currentLibraryEpisodeId;

    showActionToast(
        t("libraryAutoCompleteQuestion"),
        [
            {
                label: t("libraryAutoCompleteConfirm"),
                onClick: async () => {
                    try {
                        await saveLibraryWatchProgress({
                            force: true,
                            completed: true,
                            skipAutoCompletePrompt: true,
                            rethrowErrors: true
                        });
                        showToast(t("libraryAutoCompleteSaved"), "success", 3000);
                    } catch (err) {
                        showToast(
                            t("libraryAutoCompleteSaveFailed", { message: (err instanceof Error ? err.message : String(err)) }),
                            "error",
                            6000
                        );
                    }
                }
            },
            {
                label: t("libraryAutoCompleteDismiss"),
                onClick: () => {
                    libraryAutoCompleteDismissedEpisodeIdState.value = state.currentLibraryEpisodeId;
                }
            }
        ],
        "info",
        0
    );
}

export async function saveLibraryWatchProgress({
    force = false,
    completed = false,
    skipAutoCompletePrompt = false,
    rethrowErrors = false
} = {}) {
    if (!state.currentLibraryEpisodeId) return null;
    if (!Number.isFinite(video.currentTime)) return null;

    const now = Date.now();

    if (!force && now - libraryProgressLastSentAtMsState.value < 10000) {
        return null;
    }

    if (libraryProgressSaveInFlightState.value) {
        return null;
    }

    const currentTime = Number(video.currentTime || 0);
    const duration = Number.isFinite(video.duration) ? Number(video.duration) : null;
    const watchedDelta = getLibraryWatchedDeltaSeconds(currentTime);

    libraryProgressLastSentAtMsState.value = now;
    libraryProgressSaveInFlightState.value = true;

    try {
        const { response, data } = await apiJson<LibraryProgressPayload>(
            `/library/episodes/${encodeURIComponent(state.currentLibraryEpisodeId)}/progress`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    currentTimeSeconds: currentTime,
                    durationSeconds: duration,
                    watchedDeltaSeconds: watchedDelta,
                    completed
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(getApiErrorMessage(data, "Could not save watch progress"));
        }

        if (!skipAutoCompletePrompt && !completed) {
            maybePromptLibraryAutoComplete(data.progress);
        }

        return data.progress || null;
    } catch (err) {
        logger.warn("Could not save library watch progress:", err);
        if (rethrowErrors) {
            throw err;
        }
        return null;
    } finally {
        libraryProgressSaveInFlightState.value = false;
    }
}

export function installLibraryProgressListeners() {
    video.addEventListener("timeupdate", () => {
        if (!state.currentLibraryEpisodeId || video.paused) return;

        saveLibraryWatchProgress();
    });

    video.addEventListener("pause", () => {
        saveLibraryWatchProgress({ force: true });
    });

    video.addEventListener("ended", () => {
        saveLibraryWatchProgress({
            force: true,
            completed: true
        });
    });

    window.addEventListener("beforeunload", () => {
        if (!state.currentLibraryEpisodeId) return;

        const currentTime = Number(video.currentTime || 0);
        const duration = Number.isFinite(video.duration) ? Number(video.duration) : null;
        const watchedDelta = getLibraryWatchedDeltaSeconds(currentTime);

        const payload = JSON.stringify({
            currentTimeSeconds: currentTime,
            durationSeconds: duration,
            watchedDeltaSeconds: watchedDelta,
            completed: false
        });

        navigator.sendBeacon(
            buildApiUrl(`/library/episodes/${encodeURIComponent(state.currentLibraryEpisodeId)}/progress`),
            new Blob([payload], { type: "application/json" })
        );
    });
}

installLibraryProgressListeners();
