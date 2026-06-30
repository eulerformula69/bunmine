function findSubtitleIndexForOffset(
    cues: SubtitleCue[],
    currentTime: number,
    offset: number
): number {
    if (!cues.length) return -1;

    let currentIdx = cues.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);

    if (currentIdx === -1) {
        currentIdx = offset > 0
            ? cues.findIndex((cue) => cue.start > currentTime)
            : cues.filter((cue) => cue.end < currentTime).length - 1;
    } else {
        currentIdx += offset;
    }

    return Math.max(0, Math.min(cues.length - 1, currentIdx));
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
