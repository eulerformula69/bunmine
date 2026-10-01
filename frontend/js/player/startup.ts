import { initTargetNoteDropdown,refreshTargetNoteList } from "./controllers.js";

import { updateIconButtons } from "./ui.js";

import { initSubtitleSidebar } from "../subtitles/subtitles-sidebar.js";

import { loadLibraryEpisodeFromUrl,restoreCurrentVideoFromServer } from "../video/playback-restore.js";

import { getJapaneseTokenizer } from "../japanese/japanese-tokenizer.js";

import { checkKnownAnkiWordsStaleOnPlayerOpen,loadHighlightWordIndexes } from "../highlighter/word-index-sync.js";

import { getActiveSubtitleEntries,getActiveSubtitles,getCurrentSubtitle } from "../subtitles/timing.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { overlay } from "../core/dom.js";

import { ankiSubtitleHighlighter,ensureStatusesForSubtitleText } from "../highlighter/anki-highlighter.js";

export function startPlayer() {
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
                cues: getActiveSubtitles(),
                cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
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
}
