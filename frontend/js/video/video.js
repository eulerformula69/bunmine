async function handleFiles(files) {
    let videoFile = null;
    let subtitleFile = null;
    let hasSubtitles = false;

    for (const file of files) {
        const lowerName = file.name.toLowerCase();

		if (lowerName.endsWith(".srt")) {
			subtitleFile = file;
			subtitles = parseSRT(await file.text());
			hasSubtitles = true;
		} else if (lowerName.endsWith(".ass")) {
			subtitleFile = file;

			// ASS больше не парсим в браузере.
			// Ждём, пока сервер сконвертирует ASS -> SRT.
			subtitles = [];
			hasSubtitles = true;
		} else if (file.type.startsWith("video")) {
			videoFile = file;
		}
    }

    if (videoFile) {
        if (!hasSubtitles) {
            subtitles = [];
            lastRuntimeSubtitleText = "";

            renderSubtitleOverlay({
                overlay,
                text: ""
            });
        }

        video.src = URL.createObjectURL(videoFile);
        dropzone.classList.add("hidden");

        uploadVideoInBackground(videoFile, subtitleFile);
    }

    lastRuntimeSubtitleText = "";
    runtimePrefetchAllRunId += 1;
	runtimeHighlightPrefetchReady = false;

    clearRuntimeWordStatuses?.();

    renderSubtitles();

    requestAnimationFrame(() => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
}


async function uploadVideoInBackground(videoFile, subtitleFile = null) {
    const form = new FormData();
    form.append("videoFile", videoFile);

    try {
        const { data } = await apiJson("/upload-video", {
            method: "POST",
            body: form
        });

        if (data.error) {
            console.error("Server upload error:", data.error);
            showToast(t("toastVideoUploadFailed", { message: data.error }), "error", 5000);
            return;
        }

        currentVideoFile = data.filename;
        loadAudioTrackList(data.filename);

        if (subtitleFile) {
            await uploadSubtitleInBackground(subtitleFile, data.filename);
        }

    } catch (e) {
        console.error("Upload failed:", e);
        showToast(t("toastVideoUploadFailed", { message: e.message }), "error", 5000);
    }
}

async function uploadSubtitleInBackground(subtitleFile, videoFilename) {
    const form = new FormData();

    form.append("subtitleFile", subtitleFile);
    form.append("videoFilename", videoFilename);

    try {
        const { data } = await apiJson("/upload-subtitle", {
            method: "POST",
            body: form
        });

        if (data.error) {
            console.error("Subtitle upload error:", data.error);
            showToast(t("toastSubtitleUploadFailed", { message: data.error }), "error", 5000);
            return;
        }

        console.log("Subtitle uploaded:", data.filename);

        // ВАЖНО:
        // сервер вернул уже .srt, даже если на вход был .ass
        if (data.filename) {
            await restoreSubtitleFromServer(data.filename);
        }

    } catch (err) {
        console.error("Subtitle upload failed:", err);
        showToast(t("toastSubtitleUploadFailed", { message: err.message }), "error", 5000);
    }
}

async function restoreSubtitleFromServer(subtitleFilename) {
    try {
        const res = await fetch(buildApiUrl(`/subtitle/${encodeURIComponent(subtitleFilename)}`));

        if (!res.ok) {
            throw new Error(`Subtitle load failed: HTTP ${res.status}`);
        }

        const text = await res.text();
        const lowerName = subtitleFilename.toLowerCase();

        if (lowerName.endsWith(".srt")) {
            subtitles = parseSRT(text);
        }  else {
            throw new Error("Unsupported subtitle format");
        }

        lastRuntimeSubtitleText = "";
        runtimePrefetchAllRunId += 1;
		runtimeHighlightPrefetchReady = false;

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        requestAnimationFrame(() => {
            prefetchRuntimeStatusesForAllSubtitles({ silent: true });
        });

        showToast(t("toastVideoAndSubtitlesRestored"), "info", 2500);
    } catch (err) {
        console.error("Could not restore subtitles:", err);
        showToast(t("toastVideoRestoredSubtitlesFailed"), "error", 5000);
    }
}

async function restoreCurrentVideoFromServer() {
    try {
        const { data } = await apiJson("/videos");

        const videos = Array.isArray(data.videos) ? data.videos : [];

        if (!videos.length) {
            dropzone.classList.remove("hidden");
            return;
        }

        if (videos.length === 1) {
            await restoreSelectedVideoFromServer(videos[0]);
            return;
        }

        showVideoPickerModal(videos);
    } catch (err) {
        console.warn("Could not restore videos from server:", err);
        dropzone.classList.remove("hidden");
    }
}

async function restoreSelectedVideoFromServer(videoInfo) {
    if (!videoInfo?.filename) {
        dropzone.classList.remove("hidden");
        return;
    }

    currentVideoFile = videoInfo.filename;

    video.src = buildApiUrl(`/video/${encodeURIComponent(videoInfo.filename)}`);
    video.load();

    dropzone.classList.add("hidden");
    videoPickerModal?.classList.add("hidden");

    loadAudioTrackList(videoInfo.filename);

    if (videoInfo.subtitleFilename) {
        await restoreSubtitleFromServer(videoInfo.subtitleFilename);
    } else {
        subtitles = [];
        lastRuntimeSubtitleText = "";

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast(t("toastSelectedVideoLoadFailed"), "error", 5000);
    }

    video.addEventListener("loadedmetadata", () => {
        console.log("Restored video loaded:", video.duration);
    }, { once: true });

    video.addEventListener("error", () => {
        console.error("Video restore failed:", video.error);
        showToast("Could not load selected video", "error", 5000);
        dropzone.classList.remove("hidden");
    }, { once: true });
}

function showVideoPickerModal(videos) {
    if (!videoPickerModal || !videoPickerList) {
        return;
    }

    videoPickerList.innerHTML = "";

    videos.forEach((videoInfo) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "video-picker-item";

        const title = document.createElement("div");
        title.className = "video-picker-title";
        title.textContent = videoInfo.filename;

        const subtitle = document.createElement("div");
        subtitle.className = "video-picker-subtitle";
		subtitle.textContent = videoInfo.subtitleFilename
			? t("subtitleFound", { name: videoInfo.subtitleFilename })
			: t("subtitleNotFound");

        item.appendChild(title);
        item.appendChild(subtitle);

        item.addEventListener("click", () => {
            restoreSelectedVideoFromServer(videoInfo);
        });

        videoPickerList.appendChild(item);
    });

    dropzone.classList.add("hidden");
    videoPickerModal.classList.remove("hidden");
}


async function loadLibraryEpisodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const episodeId = params.get("episodeId");

    if (!episodeId) return false;

    try {
        const { response, data } = await apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/playback`);

        if (!response.ok || data.error) {
            throw new Error(data.error || "Could not load library episode");
        }

        await loadLibraryEpisodePlayback(data);
        return true;
    } catch (err) {
        console.error("Library episode load failed:", err);
        showToast(`Could not load library episode: ${err.message}`, "error", 6000);
        dropzone.classList.remove("hidden");
        return false;
    }
}


async function loadLibraryEpisodePlayback(playback) {
    currentLibraryEpisodeId = playback.episodeId;
    currentLibraryVideoFileId = playback.videoFileId;
    currentLibrarySubtitleFileId = playback.subtitleFileId || null;

	resetLibraryProgressTracking();

    // В library-режиме пока не используем старое имя файла из UploadedVideos.
    // Следующим шагом адаптируем screenshot/audio endpoints под episodeId.
    currentVideoFile = null;

    subtitles = [];
    lastRuntimeSubtitleText = "";
    runtimePrefetchAllRunId += 1;
    runtimeHighlightPrefetchReady = false;

    clearRuntimeWordStatuses?.();

    video.src = buildApiUrl(playback.videoUrl);
    video.load();

    dropzone.classList.add("hidden");
    videoPickerModal?.classList.add("hidden");
	
	loadAudioTrackList({
		videoFileId: playback.videoFileId
	});	

    if (playback.subtitleUrl) {
        await restoreLibrarySubtitle(playback.subtitleUrl);
    } else {
        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast("No subtitles found for this episode", "info", 4000);
    }

    video.addEventListener("loadedmetadata", () => {
        const startTime = Number(playback.currentTimeSeconds || 0);

        if (startTime > 0 && startTime < video.duration) {
            video.currentTime = startTime;
        }

		requestAnimationFrame(() => {
			restoreSubtitleFromCurrentTime();
		});

        console.log(
            `Library episode loaded: ${playback.seriesTitle} / ${playback.episodeTitle}`
        );
    }, { once: true });

    video.addEventListener("error", () => {
        console.error("Library video load failed:", video.error);
        showToast("Could not load library video", "error", 6000);
        dropzone.classList.remove("hidden");
    }, { once: true });

    requestAnimationFrame(() => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
}


async function restoreLibrarySubtitle(subtitleUrl) {
    try {
        const res = await fetch(buildApiUrl(subtitleUrl));

        if (!res.ok) {
            throw new Error(`Subtitle request failed: ${res.status}`);
        }

        const text = await res.text();

        let parsed = parseSRT(text);

        // /library/file/<id> не содержит расширения в URL,
        // поэтому если SRT не распарсился, пробуем ASS.
        if (!parsed.length) {
            parsed = parseASS(text);
        }

        subtitles = parsed;
        lastRuntimeSubtitleText = "";

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        if (!subtitles.length) {
            showToast("Subtitle file was loaded, but no subtitles were parsed", "error", 5000);
        }
    } catch (err) {
        console.error("Library subtitle restore failed:", err);
        subtitles = [];

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast(`Could not load subtitles: ${err.message}`, "error", 6000);
    }
}

function getCurrentVideoPayload() {
    if (currentLibraryVideoFileId) {
        return {
            videoFileId: currentLibraryVideoFileId
        };
    }

    if (currentVideoFile) {
        return {
            filename: currentVideoFile
        };
    }

    return null;
}

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

    // Считаем только обычное движение вперёд.
    // Перемотки и большие скачки не считаем как просмотр.
    if (delta <= 0 || delta > 15) {
        return 0;
    }

    return delta;
}

function shouldPromptLibraryAutoComplete(progress) {
    if (!currentLibraryEpisodeId || !progress) return false;
    if (progress.completed) return false;
    if (libraryAutoCompletePromptEpisodeId === currentLibraryEpisodeId) return false;
    if (libraryAutoCompleteDismissedEpisodeId === currentLibraryEpisodeId) return false;

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

function maybePromptLibraryAutoComplete(progress) {
    if (!shouldPromptLibraryAutoComplete(progress)) return;

    libraryAutoCompletePromptEpisodeId = currentLibraryEpisodeId;

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
                            t("libraryAutoCompleteSaveFailed", { message: err.message }),
                            "error",
                            6000
                        );
                    }
                }
            },
            {
                label: t("libraryAutoCompleteDismiss"),
                onClick: () => {
                    libraryAutoCompleteDismissedEpisodeId = currentLibraryEpisodeId;
                }
            }
        ],
        "info",
        0
    );
}

async function saveLibraryWatchProgress({
    force = false,
    completed = false,
    skipAutoCompletePrompt = false,
    rethrowErrors = false
} = {}) {
    if (!currentLibraryEpisodeId) return null;
    if (!Number.isFinite(video.currentTime)) return null;

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
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(currentLibraryEpisodeId)}/progress`,
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
            throw new Error(data.error || "Could not save watch progress");
        }

        if (!skipAutoCompletePrompt && !completed) {
            maybePromptLibraryAutoComplete(data.progress);
        }

        return data.progress || null;
    } catch (err) {
        console.warn("Could not save library watch progress:", err);
        if (rethrowErrors) {
            throw err;
        }
        return null;
    } finally {
        libraryProgressSaveInFlight = false;
    }
}

function installLibraryProgressListeners() {
    video.addEventListener("timeupdate", () => {
        if (!currentLibraryEpisodeId || video.paused) return;

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
        if (!currentLibraryEpisodeId) return;

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
            buildApiUrl(`/library/episodes/${encodeURIComponent(currentLibraryEpisodeId)}/progress`),
            new Blob([payload], { type: "application/json" })
        );
    });
}

installLibraryProgressListeners();




