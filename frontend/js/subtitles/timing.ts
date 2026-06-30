// state helpers

function getCurrentSubtitle() {
    const t = video.currentTime - globalSubDelay;
    return subtitles.find((s) => t >= s.start && t <= s.end);
}
