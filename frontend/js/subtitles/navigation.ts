function findSubtitleIndexForOffset(
    cues: SubtitleCue[],
    currentTime: number,
    offset: number
): number {
    if (!cues.length) return -1;

    const groups = getSubtitleStartGroups(cues);
    if (!groups.length) return -1;
    if (offset > 0) {
        const next = groups.find((group) => group.start > currentTime + 0.02);
        return (next || groups[groups.length - 1]).index;
    }
    const current = [...groups].reverse().find((group) => group.start <= currentTime + 0.02);
    if (current && currentTime - current.start > 0.25) return current.index;
    const previous = [...groups].reverse().find((group) => group.start < (current?.start ?? currentTime) - 0.02);
    return (previous || groups[0]).index;
}

function getSubtitleStartGroups(cues: SubtitleCue[]): Array<{ start: number; index: number }> {
    const groups: Array<{ start: number; index: number }> = [];
    cues.forEach((cue, index) => {
        if (!groups.length || Math.abs(groups[groups.length - 1].start - cue.start) > 0.02) {
            groups.push({ start: cue.start, index });
        }
    });
    return groups;
}

function findSubtitleIndexForPlaybackTime(
    cues: SubtitleCue[],
    currentTime: number,
    delaySeconds: number
): number {
    if (!cues.length || !Number.isFinite(currentTime)) return -1;

    const adjustedTime = currentTime - delaySeconds;
    let index = cues.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);

    if (index === -1) {
        index = cues.findIndex((cue) => cue.start > adjustedTime);
    }

    return index;
}
