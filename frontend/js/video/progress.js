const LIBRARY_AUTO_COMPLETE_MIN_WATCHED_RATIO = 0.75;
const LIBRARY_AUTO_COMPLETE_POSITION_RATIO = 0.92;
const LIBRARY_AUTO_COMPLETE_ENDING_RATIO = 0.05;
const LIBRARY_AUTO_COMPLETE_ENDING_MAX_SECONDS = 90;
let libraryProgressLastSentAtMs = 0;
let libraryProgressLastVideoTime = 0;
let libraryProgressSaveInFlight = false;
let libraryAutoCompletePromptEpisodeId = null;
let libraryAutoCompleteDismissedEpisodeId = null;
function resetLibraryProgressTracking() {
    libraryProgressLastSentAtMs = 0;
    libraryProgressLastVideoTime = Number.isFinite(video.currentTime)
        ? video.currentTime
        : 0;
    libraryAutoCompletePromptEpisodeId = null;
    libraryAutoCompleteDismissedEpisodeId = null;
}
function getLibraryWatchedDeltaSeconds(currentTime) {
    const previousTime = Number(libraryProgressLastVideoTime || 0);
    const delta = currentTime - previousTime;
    libraryProgressLastVideoTime = currentTime;
    // РЎС‡РёС‚Р°РµРј С‚РѕР»СЊРєРѕ РѕР±С‹С‡РЅРѕРµ РґРІРёР¶РµРЅРёРµ РІРїРµСЂС‘Рґ.
    // РџРµСЂРµРјРѕС‚РєРё Рё Р±РѕР»СЊС€РёРµ СЃРєР°С‡РєРё РЅРµ СЃС‡РёС‚Р°РµРј РєР°Рє РїСЂРѕСЃРјРѕС‚СЂ.
    if (delta <= 0 || delta > 15) {
        return 0;
    }
    return delta;
}
function shouldPromptLibraryAutoComplete(progress) {
    if (!currentLibraryEpisodeId || !progress)
        return false;
    if (progress.completed)
        return false;
    if (libraryAutoCompletePromptEpisodeId === currentLibraryEpisodeId)
        return false;
    if (libraryAutoCompleteDismissedEpisodeId === currentLibraryEpisodeId)
        return false;
    const duration = Number(progress.duration_seconds ?? video.duration ?? 0);
    const currentTime = Number(progress.current_time_seconds ?? video.currentTime ?? 0);
    const watchedSeconds = Number(progress.watched_seconds ?? 0);
    if (!Number.isFinite(duration) || duration <= 0)
        return false;
    if (!Number.isFinite(currentTime) || currentTime <= 0)
        return false;
    if (!Number.isFinite(watchedSeconds) || watchedSeconds <= 0)
        return false;
    const watchedRatio = watchedSeconds / duration;
    const positionRatio = currentTime / duration;
    const remainingSeconds = Math.max(0, duration - currentTime);
    const endingThresholdSeconds = Math.min(LIBRARY_AUTO_COMPLETE_ENDING_MAX_SECONDS, duration * LIBRARY_AUTO_COMPLETE_ENDING_RATIO);
    const watchedEnough = watchedRatio >= LIBRARY_AUTO_COMPLETE_MIN_WATCHED_RATIO;
    const nearEnd = positionRatio >= LIBRARY_AUTO_COMPLETE_POSITION_RATIO ||
        remainingSeconds <= endingThresholdSeconds;
    return watchedEnough && nearEnd;
}
function maybePromptLibraryAutoComplete(progress) {
    if (!shouldPromptLibraryAutoComplete(progress))
        return;
    libraryAutoCompletePromptEpisodeId = currentLibraryEpisodeId;
    showActionToast(t("libraryAutoCompleteQuestion"), [
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
                }
                catch (err) {
                    showToast(t("libraryAutoCompleteSaveFailed", { message: err.message }), "error", 6000);
                }
            }
        },
        {
            label: t("libraryAutoCompleteDismiss"),
            onClick: () => {
                libraryAutoCompleteDismissedEpisodeId = currentLibraryEpisodeId;
            }
        }
    ], "info", 0);
}
async function saveLibraryWatchProgress({ force = false, completed = false, skipAutoCompletePrompt = false, rethrowErrors = false } = {}) {
    if (!currentLibraryEpisodeId)
        return null;
    if (!Number.isFinite(video.currentTime))
        return null;
    const now = Date.now();
    if (!force && now - libraryProgressLastSentAtMs < 10000) {
        return null;
    }
    if (libraryProgressSaveInFlight) {
        return null;
    }
    const currentTime = Number(video.currentTime || 0);
    const duration = Number.isFinite(video.duration) ? Number(video.duration) : null;
    const watchedDelta = getLibraryWatchedDeltaSeconds(currentTime);
    libraryProgressLastSentAtMs = now;
    libraryProgressSaveInFlight = true;
    try {
        const { response, data } = await apiJson(`/library/episodes/${encodeURIComponent(currentLibraryEpisodeId)}/progress`, {
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
        });
        if (!response.ok || data.error) {
            throw new Error(getApiErrorMessage(data, "Could not save watch progress"));
        }
        if (!skipAutoCompletePrompt && !completed) {
            maybePromptLibraryAutoComplete(data.progress);
        }
        return data.progress || null;
    }
    catch (err) {
        console.warn("Could not save library watch progress:", err);
        if (rethrowErrors) {
            throw err;
        }
        return null;
    }
    finally {
        libraryProgressSaveInFlight = false;
    }
}
function installLibraryProgressListeners() {
    video.addEventListener("timeupdate", () => {
        if (!currentLibraryEpisodeId || video.paused)
            return;
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
        if (!currentLibraryEpisodeId)
            return;
        const currentTime = Number(video.currentTime || 0);
        const duration = Number.isFinite(video.duration) ? Number(video.duration) : null;
        const watchedDelta = getLibraryWatchedDeltaSeconds(currentTime);
        const payload = JSON.stringify({
            currentTimeSeconds: currentTime,
            durationSeconds: duration,
            watchedDeltaSeconds: watchedDelta,
            completed: false
        });
        navigator.sendBeacon(buildApiUrl(`/library/episodes/${encodeURIComponent(currentLibraryEpisodeId)}/progress`), new Blob([payload], { type: "application/json" }));
    });
}
installLibraryProgressListeners();
