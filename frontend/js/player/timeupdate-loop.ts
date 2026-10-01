import { logger } from "../core/logger.js";
import { overlay,progress,sidebar,timeLabel,video } from "../core/dom.js";

import { getActiveSubtitleEntries,getActiveSubtitles,getCurrentSubtitle } from "../subtitles/timing.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { state } from "../core/state.js";

import { ankiSubtitleHighlighter,ensureStatusesForSubtitleText } from "../highlighter/anki-highlighter.js";

import { prefetchRuntimeStatusesForAllSubtitles } from "./controllers.js";

import { formatTime } from "../core/formatters.js";

import { syncSubtitleStyle } from "../subtitles/subtitles-sidebar.js";

import { clearSearchMatches,getCurrentSearchMatch } from "../subtitles/search-controller.js";

import { findActiveSubtitleIndexAtTime,getAdjustedPlaybackTime } from "./playback-loop.js";

export function hasActiveSubtitleTextSelection(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    return Boolean(
        (anchor && (overlay.contains(anchor) || sidebar.contains(anchor))) ||
        (focus && (overlay.contains(focus) || sidebar.contains(focus)))
    );
}

export function createTimeupdateLoop(options: { getCurrentSubtitle?: typeof getCurrentSubtitle; render?: typeof renderSubtitleOverlay } = {}) {
    const currentSubtitle = options.getCurrentSubtitle || getCurrentSubtitle;
    const render = options.render || renderSubtitleOverlay;
    return () => {
    const activeSubtitles = getActiveSubtitles();
    const sub = currentSubtitle() || null;
    const isSelectingSubtitleText = hasActiveSubtitleTextSelection();

    if (sub?.text && sub.text !== state.lastRuntimeSubtitleText) {
        state.lastRuntimeSubtitleText = sub.text;

        ensureStatusesForSubtitleText(sub.text).catch((err) => {
            logger.warn("Runtime subtitle status lookup failed:", err);
        });
    }

	if (sub) {
		const currentSubtitleIndex = state.subtitles.indexOf(sub);

		if (currentSubtitleIndex !== -1) {
			const windowSize =
				state.runtimePrefetchWindowEnd - state.runtimePrefetchWindowStart + 1;

			const halfPoint =
				state.runtimePrefetchWindowStart + Math.floor(windowSize / 2);

			const shouldPrefetchNextWindow =
				state.runtimePrefetchWindowStart !== -1 &&
				state.runtimePrefetchWindowEnd !== -1 &&
				currentSubtitleIndex >= halfPoint &&
				state.runtimeNextPrefetchStart < state.subtitles.length &&
				!state.runtimePrefetchAllInProgress;

			if (shouldPrefetchNextWindow) {
				logger.info(
					`Runtime next window trigger: current=${currentSubtitleIndex}, next=${state.runtimeNextPrefetchStart}`
				);

				prefetchRuntimeStatusesForAllSubtitles({
					silent: true,
					startIndex: state.runtimeNextPrefetchStart
				});
			}
		}
	}

    if (!isSelectingSubtitleText) {
        render({
            overlay,
            cues: activeSubtitles,
            cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
            highlighter: ankiSubtitleHighlighter
        });
    }

    progress.value = String((video.currentTime / video.duration) * 100 || 0);
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

    if (!video.paused && sub && !isSelectingSubtitleText) {
        const idx = state.subtitles.indexOf(sub);
        syncSubtitleStyle(idx);
    }

	const currentSearchMatch = getCurrentSearchMatch?.();

	if (currentSearchMatch && !video.paused) {
		const currentSubtitleIndex = findActiveSubtitleIndexAtTime(
			state.subtitles,
			getAdjustedPlaybackTime(video, state.globalSubDelay)
		);

		if (
			currentSubtitleIndex !== -1 &&
			currentSubtitleIndex !== currentSearchMatch.subtitleIndex
		) {
			clearSearchMatches?.();
		}
	}

    };
}
