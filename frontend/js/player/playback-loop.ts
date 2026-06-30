function getAdjustedPlaybackTime(videoEl: HTMLVideoElement, subtitleDelaySeconds: number): number {
    return videoEl.currentTime - subtitleDelaySeconds;
}

function findActiveSubtitleIndexAtTime(cues: SubtitleCue[], adjustedTime: number): number {
    return cues.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);
}

function getActiveSubtitleAtTime(cues: SubtitleCue[], adjustedTime: number): SubtitleCue | null {
    const index = findActiveSubtitleIndexAtTime(cues, adjustedTime);
    return index >= 0 ? cues[index] : null;
}

// TODO: Move requestAnimationFrame playback loop after subtitle render/highlighter calls are isolated.
