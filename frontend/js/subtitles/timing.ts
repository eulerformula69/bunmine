import { state } from "../core/state.js";

import { RuntimeSubtitleCue } from "./model.js";

import { video } from "../core/dom.js";

import { syncSubtitleStyle } from "./subtitles-sidebar.js";

// state helpers

export function getCurrentSubtitle() {
	const index = getPrimarySubtitleIndex();
	return index >= 0 ? state.subtitles[index] : undefined;
}

export function getActiveSubtitles(): RuntimeSubtitleCue[] {
	return getActiveSubtitleEntries().map((entry) => entry.cue);
}

export function getActiveSubtitleEntries(): Array<{ index: number; cue: RuntimeSubtitleCue }> {
	const time = video.currentTime - state.globalSubDelay;
	return state.subtitles
		.map((cue, index) => ({ cue, index }))
		.filter(({ cue }) => time >= cue.start && time <= cue.end)
		.sort((left, right) => Number(left.cue.layer || 0) - Number(right.cue.layer || 0));
}

export function getPrimarySubtitleIndex(): number {
	const active = getActiveSubtitleEntries();
	if (!active.length) return -1;
	const selected = active.find(({ index }) => index === state.lastClickedSubtitleIdx);
	if (selected) return selected.index;
	const dialogue = active.find(({ cue }) => {
		const alignment = Number(cue.alignment || 2);
		return alignment <= 3 && cue.positionX === undefined && !/(sign|song|title)/i.test(String(cue.style || ""));
	});
	return (dialogue || active[0]).index;
}

export function selectPrimarySubtitle(index: number): void {
	if (!Number.isInteger(index) || !state.subtitles[index]) return;
	state.lastClickedSubtitleIdx = index;
	syncSubtitleStyle(index);
}
