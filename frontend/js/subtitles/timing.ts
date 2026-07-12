// state helpers

function getCurrentSubtitle() {
	const index = getPrimarySubtitleIndex();
	return index >= 0 ? subtitles[index] : undefined;
}

function getActiveSubtitles(): SubtitleCue[] {
	return getActiveSubtitleEntries().map((entry) => entry.cue);
}

function getActiveSubtitleEntries(): Array<{ index: number; cue: SubtitleCue }> {
	const time = video.currentTime - globalSubDelay;
	return subtitles
		.map((cue, index) => ({ cue, index }))
		.filter(({ cue }) => time >= cue.start && time <= cue.end)
		.sort((left, right) => Number(left.cue.layer || 0) - Number(right.cue.layer || 0));
}

function getPrimarySubtitleIndex(): number {
	const active = getActiveSubtitleEntries();
	if (!active.length) return -1;
	const selected = active.find(({ index }) => index === lastClickedSubtitleIdx);
	if (selected) return selected.index;
	const dialogue = active.find(({ cue }) => {
		const alignment = Number(cue.alignment || 2);
		return alignment <= 3 && cue.positionX === undefined && !/(sign|song|title)/i.test(String(cue.style || ""));
	});
	return (dialogue || active[0]).index;
}

function selectPrimarySubtitle(index: number): void {
	if (!Number.isInteger(index) || !subtitles[index]) return;
	lastClickedSubtitleIdx = index;
	syncSubtitleStyle(index);
}
