import assert from "node:assert/strict";

const frames = new Map();
const timers = new Map();
let serial = 0;
Object.assign(globalThis, {
    requestAnimationFrame: (fn) => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (fn) => { timers.set(++serial, fn); return serial; },
    clearTimeout: (id) => timers.delete(id),
});
const context = await import("../dist/esm/player/candidate-loop.js");
const listeners = {};
const media = {
    currentTime: 0, duration: 20, readyState: 4, paused: false, playbackRate: 1,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    play() { this.paused = false; listeners.play(); return Promise.resolve(); },
};
const loop = context.createCandidateLoop(media);
loop.set({ audioStart: 5, audioEnd: 9 }, true);
assert.equal(media.currentTime, 5);
media.currentTime = 9;
[...frames.values()][0]();
assert.equal(media.currentTime, 5);
media.currentTime = 2;
listeners.seeking();
assert.equal(media.currentTime, 5);
media.currentTime = 8;
loop.set({ audioStart: 5, audioEnd: 7 });
assert.equal(media.currentTime, 5);
media.paused = true;
listeners.pause();
assert.equal(frames.size, 0);
assert.equal(timers.size, 0);
media.play();
media.currentTime = 7;
[...timers.values()][0]();
assert.equal(media.currentTime, 5);
loop.set({ audioStart: 15, audioEnd: 22 });
media.currentTime = 20;
media.paused = true;
listeners.ended();
assert.equal(media.currentTime, 15);
assert.equal(media.paused, false);
loop.set(null);
media.currentTime = 19;
listeners.timeupdate();
assert.equal(media.currentTime, 19);
assert.equal(frames.size, 0);
loop.set({ audioStart: 5, audioEnd: 9 });
listeners.emptied();
media.currentTime = 0;
listeners.timeupdate();
assert.equal(media.currentTime, 0);
console.log("Candidate loop: boundaries, edits, pause, resume, source change and end of file passed");

const errors = [];
let rejectPlay;
media.play = () => new Promise((resolve, reject) => { rejectPlay = reject; });
let pending = loop.play((error) => errors.push(error));
rejectPlay({ name: "AbortError" });
await pending;
assert.equal(errors.length, 0, "A normal pause must not report an error or retry play");
pending = loop.play((error) => errors.push(error));
loop.set(null);
rejectPlay(new Error("Old source failed"));
await pending;
assert.equal(errors.length, 0, "A previous candidate must not overwrite current status");
pending = loop.play((error) => errors.push(error));
rejectPlay({ name: "NotAllowedError" });
await pending;
assert.equal(errors.length, 1, "Actual playback failures must remain visible");
console.log("Candidate play cancellation and current playback errors passed");

// Browsers store media time at finite precision, unlike the saved JS calculation.
let roundedTime = 0;
let seeks = 0;
Object.defineProperty(media, "currentTime", {
    get: () => roundedTime,
    set: (value) => { roundedTime = Math.round(value * 1000000) / 1000000; seeks++; },
});
media.paused = true;
media.duration = 1460;
loop.set({ audioStart: 595.1400000000001, audioEnd: 600.78 }, true);
for (let index = 0; index < 10; index++) {
    listeners.seeking();
    listeners.seeked();
    listeners.timeupdate();
}
assert.equal(seeks, 1, "Rounded candidate start must not cause a seek loop");
roundedTime = 600.78;
listeners.timeupdate();
assert.equal(seeks, 2, "End of candidate must still loop");
assert.equal(roundedTime, 595.14);
roundedTime = 594;
listeners.seeking();
assert.equal(seeks, 3, "Seeking outside the range must still return to its start");
console.log("Rounded media clock regression for 仕上げ passed");
