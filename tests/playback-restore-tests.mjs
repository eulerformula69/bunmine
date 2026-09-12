import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

let resolveSubtitle;
const subtitlePending = new Promise((resolve) => {
    resolveSubtitle = resolve;
});

const listeners = new Map();
const video = {
    readyState: 0,
    duration: 120,
    currentTime: 0,
    currentSrc: "",
    src: "",
    load() {},
    addEventListener(name, listener) {
        listeners.set(name, listener);
    },
};

const context = {
    URLSearchParams,
    HTMLMediaElement: { HAVE_METADATA: 1 },
    console,
    window: { BunmineEarlyLibraryPlayback: undefined },
    video,
    dropzone: { classList: { add() {}, remove() {} } },
    videoPickerModal: { classList: { add() {} } },
    overlay: {},
    subtitles: [],
    lastRuntimeSubtitleText: "",
    runtimePrefetchAllRunId: 0,
    runtimeHighlightPrefetchReady: false,
    currentLibraryEpisodeId: null,
    currentLibraryVideoFileId: null,
    currentLibrarySubtitleFileId: null,
    currentVideoFile: null,
    updateEpisodeNavigation() {},
    resetLibraryProgressTracking() {},
    clearRuntimeWordStatuses() {},
    buildApiUrl(path) { return `http://localhost${path}`; },
    requestAnimationFrame(callback) { callback(); },
    restoreSubtitleFromCurrentTime() {},
    renderSubtitles() {},
    renderSubtitleOverlay() {},
    showToast() {},
    prefetchRuntimeStatusesForAllSubtitles() {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("dist/js/video/playback-restore.js", "utf8"), context);
context.restoreLibrarySubtitle = () => subtitlePending;

const loading = context.loadLibraryEpisodePlayback({
    episodeId: 7,
    videoFileId: 11,
    subtitleFileId: 12,
    videoUrl: "/library/file/11",
    subtitleUrl: "/library/file/12",
    currentTimeSeconds: 45,
    seriesTitle: "Show",
    episodeTitle: "Episode 1",
});

assert.equal(video.currentTime, 0);
assert.ok(listeners.has("loadedmetadata"));

video.readyState = 1;
listeners.get("loadedmetadata")();
assert.equal(video.currentTime, 45, "resume time must not wait for subtitle loading");

resolveSubtitle();
await loading;

console.log("playback restore tests passed");
