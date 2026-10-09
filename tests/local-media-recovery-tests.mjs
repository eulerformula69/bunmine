import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";

const dom = installDom();
const { video } = await import("../dist/esm/core/dom.js");
const { installLocalMediaRecovery } = await import("../dist/esm/video/local-media-recovery.js");

let scheduled = null;
let loadCount = 0;
let playCount = 0;
let currentTime = 25;

Object.defineProperty(video, "currentSrc", { configurable: true, get: () => "http://localhost:5000/library/file/9" });
Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value) => { currentTime = value; }
});
Object.defineProperty(video, "duration", { configurable: true, value: 120 });
video.load = () => { loadCount += 1; };

const removeRecovery = installLocalMediaRecovery({
    media: video,
    eventTarget: window,
    delayMs: 10,
    schedule: (callback) => {
        scheduled = callback;
        return 1;
    },
    cancel: () => {},
    play: async () => { playCount += 1; }
});

video.dispatchEvent(new Event("playing"));
window.dispatchEvent(new Event("offline"));
assert.equal(typeof scheduled, "function");

scheduled();
assert.equal(loadCount, 1, "a stopped local stream must reload after the network changes");

currentTime = 0;
video.dispatchEvent(new Event("loadedmetadata"));
await Promise.resolve();
assert.equal(currentTime, 25, "recovery must keep the playback position");
assert.equal(playCount, 1, "recovery must resume playback");

video.dispatchEvent(new Event("playing"));
window.dispatchEvent(new Event("offline"));
currentTime = 26;
scheduled();
assert.equal(loadCount, 1, "an advancing stream must not reload");

removeRecovery();
dom.window.close();
console.log("local media recovery tests passed");
