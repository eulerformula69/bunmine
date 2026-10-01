import { RuntimeSubtitleCue } from "../subtitles/model.js";
export function getAdjustedPlaybackTime(videoEl: HTMLVideoElement, subtitleDelaySeconds: number): number {
    return videoEl.currentTime - subtitleDelaySeconds;
}

export function findActiveSubtitleIndexAtTime(cues: RuntimeSubtitleCue[], adjustedTime: number): number {
    return cues.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);
}

export function getActiveSubtitleAtTime(cues: RuntimeSubtitleCue[], adjustedTime: number): RuntimeSubtitleCue | null {
    const index = findActiveSubtitleIndexAtTime(cues, adjustedTime);
    return index >= 0 ? cues[index] : null;
}

// TODO: Move requestAnimationFrame playback loop after subtitle render/highlighter calls are isolated.
