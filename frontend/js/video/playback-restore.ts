import { logger } from "../core/logger.js";
import { apiJson,buildApiUrl,getApiErrorMessage } from "../core/api.js";

import { VideoListResponse } from "../types/api.js";

import { dropzone,overlay,video,videoPickerList,videoPickerModal } from "../core/dom.js";

import { UploadedVideoInfo } from "./types.js";

import { state } from "../core/state.js";

import { restoreSubtitleFromServer } from "./upload.js";

import { clearRuntimeWordStatuses } from "../highlighter/word-status-store.js";

import { renderSubtitles } from "../subtitles/sidebar-render.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { t } from "../core/translate.js";
import { showToast } from "../player/ui.js";

import { LibraryPlaybackPayload } from "../types/runtime-types.js";

import { updateEpisodeNavigation } from "../player/episode-navigation.js";

import { resetLibraryProgressTracking } from "./progress.js";

import { restoreSubtitleFromCurrentTime } from "../subtitles/subtitles-sidebar.js";

import { prefetchRuntimeStatusesForAllSubtitles } from "../player/controllers.js";

import { parseSubtitleSource } from "../subtitles/parse-subtitle-source.js";

import { detectSubtitleFormat } from "../subtitles/format-detection.js";

import { toRuntimeSubtitleCues } from "../subtitles/model.js";

export async function restoreCurrentVideoFromServer(): Promise<void> {
    try {
        const { data } = await apiJson<VideoListResponse>("/videos");

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
        logger.warn("Could not restore videos from server:", err);
        dropzone.classList.remove("hidden");
    }
}

export async function restoreSelectedVideoFromServer(videoInfo: UploadedVideoInfo): Promise<void> {
    if (!videoInfo?.filename) {
        dropzone.classList.remove("hidden");
        return;
    }

    state.currentVideoFile = videoInfo.filename;

    video.src = buildApiUrl(`/video/${encodeURIComponent(videoInfo.filename)}`);
    video.load();

    dropzone.classList.add("hidden");
    videoPickerModal?.classList.add("hidden");


    if (videoInfo.subtitleFilename) {
        await restoreSubtitleFromServer(videoInfo.subtitleFilename);
    } else {
        state.subtitles = [];
        state.lastRuntimeSubtitleText = "";

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast(t("toastSelectedVideoLoadFailed"), "error", 5000);
    }

    video.addEventListener("loadedmetadata", () => {
        logger.info("Restored video loaded:", video.duration);
    }, { once: true });

    video.addEventListener("error", () => {
        logger.error("Video restore failed:", video.error);
        showToast("Could not load selected video", "error", 5000);
        dropzone.classList.remove("hidden");
    }, { once: true });
}

export function showVideoPickerModal(videos: UploadedVideoInfo[]): void {
    if (!videoPickerModal || !videoPickerList) {
        return;
    }

    videoPickerList.replaceChildren();

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

export async function loadLibraryEpisodeFromUrl(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const episodeId = params.get("episodeId");

    if (!episodeId) return false;

    try {
        const earlyPlayback = window.BunmineEarlyLibraryPlayback;
        const earlyData = earlyPlayback ? await earlyPlayback : null;
        let data: LibraryPlaybackPayload;
        let responseOk: boolean;

        if (earlyData) {
            data = earlyData;
            responseOk = !earlyData.error;
        } else {
            const result = await apiJson<LibraryPlaybackPayload>(`/library/episodes/${encodeURIComponent(episodeId)}/playback`);
            data = result.data;
            responseOk = result.response.ok;
        }

        if (!responseOk || data.error) {
            throw new Error(getApiErrorMessage(data, "Could not load library episode"));
        }

        await loadLibraryEpisodePlayback(data);
        return true;
    } catch (err) {
        logger.error("Library episode load failed:", err);
        showToast(`Could not load library episode: ${(err instanceof Error ? err.message : String(err))}`, "error", 6000);
        dropzone.classList.remove("hidden");
        return false;
    }
}

export async function loadLibraryEpisodePlayback(
    playback: LibraryPlaybackPayload,
    restoreSubtitle = restoreLibrarySubtitle
): Promise<void> {
    state.currentLibraryEpisodeId = playback.episodeId ?? null;
    state.currentLibraryVideoFileId = playback.videoFileId ?? null;
    state.currentLibrarySubtitleFileId = playback.subtitleFileId || null;
    void updateEpisodeNavigation(playback);

	resetLibraryProgressTracking();

    // Р’ library-СЂРµР¶РёРјРµ РїРѕРєР° РЅРµ РёСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°СЂРѕРµ РёРјСЏ С„Р°Р№Р»Р° РёР· UploadedVideos.
    // РЎР»РµРґСѓСЋС‰РёРј С€Р°РіРѕРј Р°РґР°РїС‚РёСЂСѓРµРј screenshot/audio endpoints РїРѕРґ episodeId.
    state.currentVideoFile = null;

    state.subtitles = [];
    state.lastRuntimeSubtitleText = "";
    state.runtimePrefetchAllRunId += 1;
    state.runtimeHighlightPrefetchReady = false;

    clearRuntimeWordStatuses?.();

    const videoUrl = buildApiUrl(playback.videoUrl);
    const startTime = Number(playback.currentTimeSeconds || 0);
    const restorePlaybackTime = () => {
        if (startTime > 0 && startTime < video.duration) {
            video.currentTime = startTime;
        }

        requestAnimationFrame(() => {
            restoreSubtitleFromCurrentTime();
        });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        restorePlaybackTime();
    } else {
        video.addEventListener("loadedmetadata", restorePlaybackTime, { once: true });
    }

    if (video.currentSrc !== videoUrl && video.src !== videoUrl) {
        video.src = videoUrl;
        video.load();
    }

    dropzone.classList.add("hidden");
    videoPickerModal?.classList.add("hidden");

    if (playback.subtitleUrl) {
        await restoreSubtitle(playback.subtitleUrl);
    } else {
        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast("No subtitles found for this episode", "info", 4000);
    }

    const logLoadedEpisode = () => {
        logger.info(
            `Library episode loaded: ${playback.seriesTitle} / ${playback.episodeTitle}`
        );
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        logLoadedEpisode();
    } else {
        video.addEventListener("loadedmetadata", logLoadedEpisode, { once: true });
    }

    video.addEventListener("error", () => {
        logger.error("Library video load failed:", video.error);
        showToast("Could not load library video", "error", 6000);
        dropzone.classList.remove("hidden");
    }, { once: true });

    requestAnimationFrame(() => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
}

export async function restoreLibrarySubtitle(subtitleUrl: string): Promise<void> {
    try {
        const res = await fetch(buildApiUrl(subtitleUrl));

        if (!res.ok) {
            throw new Error(`Subtitle request failed: ${res.status}`);
        }

        const text = await res.text();
        const parsed = await parseSubtitleSource({
            source: text,
            format: detectSubtitleFormat({ filename: subtitleUrl, source: text }),
            filename: subtitleUrl
        });

        state.subtitles = toRuntimeSubtitleCues(parsed.cues);
        state.lastRuntimeSubtitleText = "";

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        if (!state.subtitles.length) {
            showToast("Subtitle file was loaded, but no subtitles were parsed", "error", 5000);
        }
    } catch (err) {
        logger.error("Library subtitle restore failed:", err);
        state.subtitles = [];

        renderSubtitles();

        renderSubtitleOverlay({
            overlay,
            text: ""
        });

        showToast(`Could not load subtitles: ${(err instanceof Error ? err.message : String(err))}`, "error", 6000);
    }
}
