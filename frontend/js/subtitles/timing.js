// state helpers
function getCurrentSubtitle() {
    return getActiveSubtitles()[0];
}
function getActiveSubtitles() {
    const time = video.currentTime - globalSubDelay;
    return subtitles
        .filter((cue) => time >= cue.start && time <= cue.end)
        .sort((left, right) => Number(left.layer || 0) - Number(right.layer || 0));
}
