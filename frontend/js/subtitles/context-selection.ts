interface SubtitleContextSelection {
    startIndex: number;
    endIndex: number;
    startTime: number;
    endTime: number;
    text: string;
}

function buildSubtitleContextSelection(
    cues: SubtitleCue[],
    currentIndex: number,
    backDepth: number,
    forwardDepth: number
): SubtitleContextSelection | null {
    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= cues.length) {
        return null;
    }

    const startIndex = Math.max(0, currentIndex - Math.max(0, backDepth));
    const endIndex = Math.min(cues.length - 1, currentIndex + Math.max(0, forwardDepth));
    const selected = cues.slice(startIndex, endIndex + 1);

    return {
        startIndex,
        endIndex,
        startTime: selected[0]?.start ?? cues[currentIndex].start,
        endTime: selected[selected.length - 1]?.end ?? cues[currentIndex].end,
        text: selected.map((cue) => cue.text).join(" ")
    };
}
