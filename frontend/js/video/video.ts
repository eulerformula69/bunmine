import { parseSubtitleSource } from "../subtitles/parse-subtitle-source.js";

import { detectSubtitleFormat } from "../subtitles/format-detection.js";

import { state } from "../core/state.js";

import { toRuntimeSubtitleCues } from "../subtitles/model.js";

import { saveLibraryWatchProgress } from "./progress.js";

import { resetEpisodeNavigation } from "../player/episode-navigation.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { dropzone,overlay,video } from "../core/dom.js";

import { uploadVideoInBackground } from "./upload.js";

import { clearRuntimeWordStatuses } from "../highlighter/word-status-store.js";

import { renderSubtitles } from "../subtitles/sidebar-render.js";

import { prefetchRuntimeStatusesForAllSubtitles } from "../player/controllers.js";

export async function handleFiles(files) {
    let videoFile = null;
    let subtitleFile = null;
    let hasSubtitles = false;

    for (const file of files) {
        const lowerName = file.name.toLowerCase();

		if (
			lowerName.endsWith(".srt") ||
			lowerName.endsWith(".vtt") ||
			lowerName.endsWith(".ass") ||
			lowerName.endsWith(".ssa")
		) {
			subtitleFile = file;
			const parsed = await parseSubtitleSource({
				source: await file.text(),
				format: detectSubtitleFormat({ filename: file.name }),
				filename: file.name
			});
			state.subtitles = toRuntimeSubtitleCues(parsed.cues);
			hasSubtitles = true;
		} else if (file.type.startsWith("video")) {
			videoFile = file;
		}
    }

    if (videoFile) {
        state.currentVideoFile = null;
        await saveLibraryWatchProgress({ force: true, skipAutoCompletePrompt: true });
        state.currentLibraryEpisodeId = null;
        state.currentLibraryVideoFileId = null;
        state.currentLibrarySubtitleFileId = null;
        resetEpisodeNavigation();
        if (!hasSubtitles) {
            state.subtitles = [];
            state.lastRuntimeSubtitleText = "";

            renderSubtitleOverlay({
                overlay,
                text: ""
            });
        }

        video.src = URL.createObjectURL(videoFile);
        dropzone.classList.add("hidden");

        uploadVideoInBackground(videoFile, subtitleFile);
    }

    state.lastRuntimeSubtitleText = "";
    state.runtimePrefetchAllRunId += 1;
	state.runtimeHighlightPrefetchReady = false;

    clearRuntimeWordStatuses?.();

    renderSubtitles();

    requestAnimationFrame(() => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
}
