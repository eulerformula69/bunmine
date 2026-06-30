function getAdjustedPlaybackTime(videoEl, subtitleDelaySeconds) {
    return videoEl.currentTime - subtitleDelaySeconds;
}
function findActiveSubtitleIndexAtTime(cues, adjustedTime) {
    return cues.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);
}
function getActiveSubtitleAtTime(cues, adjustedTime) {
    const index = findActiveSubtitleIndexAtTime(cues, adjustedTime);
    return index >= 0 ? cues[index] : null;
}
// TODO: Move requestAnimationFrame playback loop after subtitle render/highlighter calls are isolated.
