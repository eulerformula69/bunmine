import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const {video} = await import("../dist/esm/core/dom.js");
const context = await import("../dist/esm/video/playback-restore.js");
let ready = 0;
Object.defineProperty(video,"readyState",{get:()=>ready});
Object.defineProperty(video,"duration",{value:120});
globalThis.fetch = async () => new Response(JSON.stringify({episodes:[]}));
let resolveSubtitle;
const subtitlePending = new Promise(resolve => {resolveSubtitle = resolve;});
const loading = context.loadLibraryEpisodePlayback({
    episodeId: 7,
    videoFileId: 11,
    subtitleFileId: 12,
    videoUrl: "/library/file/11",
    subtitleUrl: "/library/file/12",
    currentTimeSeconds: 45,
    seriesTitle: "Show",
    episodeTitle: "Episode 1",
}, () => subtitlePending);

assert.equal(video.currentTime, 0);


ready = 1;
video.dispatchEvent(new Event("loadedmetadata"));
assert.equal(video.currentTime, 45, "resume time must not wait for subtitle loading");

resolveSubtitle();
await loading;

console.log("playback restore tests passed");

dom.window.close();
