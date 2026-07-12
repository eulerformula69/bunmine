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
    }
    catch (err) {
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
    if (videoInfo.subtitleFilename) {
        await restoreSubtitleFromServer(videoInfo.subtitleFilename);
    }
    else {
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
    if (!episodeId)
        return false;
    try {
        const { response, data } = await apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/playback`);
        if (!response.ok || data.error) {
            throw new Error(getApiErrorMessage(data, "Could not load library episode"));
        }
        await loadLibraryEpisodePlayback(data);
        return true;
    }
    catch (err) {
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
    // Р’ library-СЂРµР¶РёРјРµ РїРѕРєР° РЅРµ РёСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°СЂРѕРµ РёРјСЏ С„Р°Р№Р»Р° РёР· UploadedVideos.
    // РЎР»РµРґСѓСЋС‰РёРј С€Р°РіРѕРј Р°РґР°РїС‚РёСЂСѓРµРј screenshot/audio endpoints РїРѕРґ episodeId.
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
    if (playback.subtitleUrl) {
        await restoreLibrarySubtitle(playback.subtitleUrl);
    }
    else {
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
        console.log(`Library episode loaded: ${playback.seriesTitle} / ${playback.episodeTitle}`);
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
        // /library/file/<id> РЅРµ СЃРѕРґРµСЂР¶РёС‚ СЂР°СЃС€РёСЂРµРЅРёСЏ РІ URL,
        // РїРѕСЌС‚РѕРјСѓ РµСЃР»Рё SRT РЅРµ СЂР°СЃРїР°СЂСЃРёР»СЃСЏ, РїСЂРѕР±СѓРµРј ASS.
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
    }
    catch (err) {
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
