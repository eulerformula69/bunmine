import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";

const dom = installDom();
const video = document.getElementById("video");
const progress = document.getElementById("progress");
const { bindProgressSlider } = await import("../dist/esm/player/progress-slider.js");
const frames = new Map();
let serial = 0;
globalThis.requestAnimationFrame = callback => {
    frames.set(++serial, callback);
    return serial;
};
globalThis.cancelAnimationFrame = id => frames.delete(id);
const nextFrame = () => {
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
};
Object.defineProperties(video, {
    duration: { configurable: true, writable: true, value: 1440 },
    paused: { configurable: true, writable: true, value: true },
    ended: { configurable: true, writable: true, value: false },
});
bindProgressSlider(video, progress);
assert.equal(Number(progress.value), 0);
assert.equal(frames.size, 0);

for (let repeat = 0; repeat < 2; repeat++) {
    video.paused = false;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("play"));
    assert.equal(frames.size, 1, "Repeated play events must keep one animation loop");
    for (const time of [10, 10.016, 10.032, 10.048]) {
        video.currentTime = time;
        nextFrame();
        assert.ok(Math.abs(Number(progress.value) - time / 1440 * 100) < 1e-9,
            "Progress must follow fractional playback time between timeupdate events");
        assert.equal(frames.size, 1);
    }
    video.paused = true;
    video.dispatchEvent(new Event("pause"));
    assert.equal(frames.size, 0);
}

progress.value = "25.125";
progress.dispatchEvent(new Event("input"));
assert.ok(Math.abs(video.currentTime - 361.8) < 1e-9, "Seeking must keep fractional precision");
video.currentTime = 500;
video.dispatchEvent(new Event("seeked"));
assert.ok(Math.abs(Number(progress.value) - 500 / 1440 * 100) < 1e-9);
assert.equal(frames.size, 0, "Seeking while paused must not start an animation loop");

video.paused = false;
video.dispatchEvent(new Event("play"));
video.currentTime = video.duration;
video.ended = true;
video.dispatchEvent(new Event("ended"));
assert.equal(Number(progress.value), 100);
assert.equal(frames.size, 0);

video.duration = NaN;
video.currentTime = 0;
video.dispatchEvent(new Event("emptied"));
assert.equal(Number(progress.value), 0);
assert.equal(frames.size, 0);
progress.value = "50";
progress.dispatchEvent(new Event("input"));
assert.equal(video.currentTime, 0, "Seeking without metadata must not set an invalid time");
dom.window.close();
console.log("Progress slider tests passed");
