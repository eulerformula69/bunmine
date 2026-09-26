import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class Element {
    children = [];
    handlers = {};
    attrs = {};
    style = {};
    dataset = {};
    classes = new Set();
    scrollTop = 0;
    disabled = false;
    classList = {
        toggle: (key, on) => on ? this.classes.add(key) : this.classes.delete(key),
        add: (key) => this.classes.add(key), remove: (key) => this.classes.delete(key),
    };
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    setAttribute(key, value) { this.attrs[key] = value; }
    addEventListener(key, handler) { this.handlers[key] = handler; }
    setPointerCapture(id) { this.pointerId = id; }
    hasPointerCapture(id) { return this.pointerId === id; }
    releasePointerCapture() { this.pointerId = null; }
    get offsetTop() { return Math.max(0, this.parent?.children.indexOf(this) || 0) * 100; }
    get offsetHeight() { return 100; }
    getBoundingClientRect() { return { top: 100, bottom: 500 }; }
    fire(key, data = {}) { this.handlers[key]?.({ preventDefault() {}, stopPropagation() {}, button: 0, pointerId: 1, ...data }); }
}
const document = new Element();
document.createElement = () => new Element();
const context = vm.createContext({ document, t: (key) => key, formatTime: String,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, ResizeObserver: class { observe() {} } });
for (const name of ["candidate-context-model", "candidate-context-editor"]) {
    vm.runInContext(fs.readFileSync(`dist/js/player/${name}.js`, "utf8"), context);
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
let top = viewport.children.at(-2);
let bottom = viewport.children.at(-1);
const settle = () => new Promise((resolve) => setImmediate(resolve));
bottom.fire("pointerdown", { clientY: 300 });
assert.equal(editing, true);
viewport.fire("pointermove", { clientY: 400 });
assert.equal(changes.length, 0);
viewport.fire("pointerup", { clientY: 400 });
await settle();
assert.deepEqual(changes[0], [1, 2]);
assert.equal(editing, false);
assert.equal(value.snapshot.combinedText, "word after");
assert.equal(value.snapshot.audioEnd, 14.3);
bottom.fire("pointerdown", { clientY: 400 });
viewport.fire("pointermove", { clientY: 500 });
viewport.fire("pointercancel");
await settle();
assert.equal(changes.length, 1);
assert.equal(value.snapshot.context.end, 2);
top.fire("keydown", { key: "ArrowUp" });
await settle();
assert.equal(value.snapshot.context.start, 0);
fail = true;
bottom.fire("keydown", { key: "ArrowDown" });
await settle();
assert.equal(errors.length, 1);
assert.equal(value.snapshot.context.end, 2);
editor.set(value, value.snapshot.context, true);
bottom.fire("keydown", { key: "ArrowDown" });
assert.equal(changes.length, 3);
console.log("Candidate context model, drag, keyboard, cancellation, and save recovery tests passed");
