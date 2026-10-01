import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const context = Object.assign({}, ...await Promise.all(["candidate-context-model", "candidate-context-editor"].map(name => import('../dist/esm/player/' + name + '.js'))));
let nextFrame;
globalThis.requestAnimationFrame = callback => {nextFrame = callback; return 1;};
globalThis.cancelAnimationFrame = () => {};
const proto = dom.window.HTMLElement.prototype;
Object.defineProperty(proto,"offsetTop",{get(){return Math.max(0,Array.from(this.parentElement?.children || []).indexOf(this))*100;}});
Object.defineProperty(proto,"offsetHeight",{get(){return 100;}});
proto.getBoundingClientRect = () => ({top:100,bottom:500});
proto.setPointerCapture = function(id){this.pointerId=id;};
proto.hasPointerCapture = function(id){return this.pointerId===id;};
proto.releasePointerCapture = function(){this.pointerId=null;};
function fire(element, key, data={}) {
    const event = new Event(key,{bubbles:true,cancelable:true});
    Object.assign(event,{button:0,pointerId:1,...data});
    element.dispatchEvent(event);
}
const cues = [
    { start: 1, end: 4, text: "before" },
    { start: 5, end: 9, text: "word" },
    { start: 10, end: 14, text: "after" },
    { start: 15, end: 19, text: "last" },
];
const snapshot = { currentIdx: 1, selectedWord: "word", combinedText: "word", audioStart: 5.2, audioEnd: 9.3,
    imageSubtitleText: "word", targetTime: 7, videoPayload: { filename: "test.mp4" } };
const captured = context.captureCandidateContext(snapshot, cues, 1, 1);
cues[0].text = "later change";
assert.equal(captured.cues[0].text, "before");
assert.ok(context.restoreCandidateContext(snapshot, captured.cues));
assert.equal(context.restoreCandidateContext({ ...snapshot, combinedText: "missing" }, cues), null);
const expanded = context.candidateContextSnapshot(snapshot, captured, 0, 2);
const timedExpanded = context.candidateContextSnapshot({ ...snapshot, imageSubtitleMode: "timed", imageSubtitleDelay: 2 }, captured, 0, 2);
assert.equal(timedExpanded.imageSubtitleCues.length, 3);
assert.equal(timedExpanded.imageSubtitleCues[0].start, 3);
assert.equal(timedExpanded.imageSubtitleCues[2].end, 16);
assert.equal(expanded.combinedText, "before word after");
assert.ok(Math.abs(expanded.audioStart - 1.2) < 0.000001);
assert.equal(expanded.audioEnd, 14.3);
assert.equal(expanded.targetTime, 7);
assert.equal(expanded.selectedWord, "word");
assert.equal(context.candidateContextSnapshot({ ...snapshot, imageSubtitleText: "" }, captured, 1, 2).imageSubtitleText, "");
assert.throws(() => context.candidateContextSnapshot(snapshot, captured, 2, 3));
assert.throws(() => context.candidateContextSnapshot(snapshot, captured, 0, 0));
let value = { id: 1, revision: 0, snapshot: { ...snapshot, context: captured } };
const changes = [];
const errors = [];
let fail = false;
let editing = false;
let editor;
editor = context.createCandidateContextEditor({
    editing: (busy) => { editing = busy; },
    error: (error) => errors.push(error),
    change: async (start, end) => {
        changes.push([start, end]);
        if (fail) throw new Error("save failed");
        value = { ...value, revision: value.revision + 1,
            snapshot: context.candidateContextSnapshot(value.snapshot, value.snapshot.context, start, end) };
        editor.set(value, value.snapshot.context, false);
    },
});
editor.set(value, captured, false);
const viewport = editor.element.children[1];
// Legacy context arrives after selection; focus waits until the hidden editor has layout.
editor.set({ ...value, id: 2 }, null, false);
editor.set({ ...value, id: 2 }, captured, false);
let height = 0;
Object.defineProperty(viewport,"clientHeight",{get:()=>height});
nextFrame();
height = 200;
nextFrame();
assert.equal(viewport.scrollTop, 50);
viewport.scrollTop = 0;
let top = Array.from(viewport.children).at(-2);
let bottom = Array.from(viewport.children).at(-1);
const settle = () => new Promise((resolve) => setImmediate(resolve));
fire(bottom, "pointerdown", { clientY: 300 });
assert.equal(editing, true);
fire(viewport, "pointermove", { clientY: 400 });
assert.equal(changes.length, 0);
fire(viewport, "pointerup", { clientY: 400 });
await settle();
assert.deepEqual(changes[0], [1, 2]);
assert.equal(editing, false);
assert.equal(value.snapshot.combinedText, "word after");
assert.equal(value.snapshot.audioEnd, 14.3);
fire(bottom, "pointerdown", { clientY: 400 });
fire(viewport, "pointermove", { clientY: 500 });
fire(viewport, "pointercancel");
await settle();
assert.equal(changes.length, 1);
assert.equal(value.snapshot.context.end, 2);
fire(top, "keydown", { key: "ArrowUp" });
await settle();
assert.equal(value.snapshot.context.start, 0);
fail = true;
fire(bottom, "keydown", { key: "ArrowDown" });
await settle();
assert.equal(errors.length, 1);
assert.equal(value.snapshot.context.end, 2);
editor.set(value, value.snapshot.context, true);
fire(bottom, "keydown", { key: "ArrowDown" });
assert.equal(changes.length, 3);
console.log("Candidate context model, drag, keyboard, cancellation, and save recovery tests passed");

dom.window.close();
