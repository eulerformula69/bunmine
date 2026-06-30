function buildSubtitleRenderModel(cue, index, currentTime, delaySeconds) {
    const adjustedTime = currentTime - delaySeconds;
    return {
        index,
        start: cue.start + delaySeconds,
        end: cue.end + delaySeconds,
        text: cue.text,
        active: adjustedTime >= cue.start && adjustedTime <= cue.end
    };
}
