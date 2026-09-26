import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const frames = new Map();
const timers = new Map();
let serial = 0;
const context = vm.createContext({
    requestAnimationFrame: (fn) => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (fn) => { timers.set(++serial, fn); return serial; },
    clearTimeout: (id) => timers.delete(id),
});
vm.runInContext(fs.readFileSync("dist/js/player/candidate-loop.js", "utf8"), context);
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
