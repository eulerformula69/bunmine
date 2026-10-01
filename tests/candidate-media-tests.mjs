import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();


const fields = {
    sentenceFuriganaField: "",
    screenshotMode: "current", pictureField: "Picture", audioField: "Audio", sentenceField: "Sentence",
    ankiUrl: "http://anki.test", deckName: "Japanese", fontSizeRange: "24", subOffsetStart: "0", subOffsetEnd: "0",
};
let includeImageSubtitle = true;
let currentContext = { startTime: 10, endTime: 15, text: "猫です。" };
const requests = [];
const context = { ...await import("../dist/esm/player/anki-actions.js"), ...await import("../dist/esm/anki/media-snapshot.js") };
function syncFields() {
    for (const [id, value] of Object.entries(fields)) document.getElementById(id).value = value;
    document.getElementById("includeImageSubtitle").checked = includeImageSubtitle;
}
globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    requests.push([path, JSON.parse(options.body)]);
    return new Response(JSON.stringify({filename: path === "/screenshot" ? "image.jpg" : "audio.mp3", result: null}));
};
syncFields();
const media = context.createAnkiMediaController({
    translate: String,
    fetchNotesInfo: async () => [{ noteId: 123, fields: { Expression: { value: "猫" } } }],
    getVideoPayload: () => ({ filename: "original.mp4" }),
    getVideoCurrentTime: () => 12,
    getValidatedVolume: () => 0.5,
    getActiveSubtitleIndex: () => 3,
    getSubtitleStart: () => 10,
    getSubtitleContext: () => currentContext,
    getGlobalSubtitleDelay: () => 1,
    resetRuntimeHighlightPrefetch() {},
    refreshKnownWord: async () => {},
    getHighlightWordFields: () => [],
    ensureSubtitleStatuses: async () => {},
    prefetchSubtitleStatuses() {},
});
const saved = media.buildSnapshot();
assert.equal(requests.length, 0);
assert.equal(saved.audioStart, 11);
assert.equal(saved.audioEnd, 16);
currentContext = { startTime: 50, endTime: 60, text: "別の文章" };
await media.updateNote(123, saved);
assert.equal(requests[0][1].time, 12);
assert.equal(requests[0][1].text, "猫です。");
assert.equal(requests[1][1].start, 11);
assert.equal(requests[1][1].end, 16);
assert.equal(requests[1][1].filename, "original.mp4");
assert.equal(requests[2][1].params.note.id, 123);
assert.ok(requests[2][1].params.note.fields.Sentence.includes("猫"));
fields.imageSubtitleMode = "timed";
syncFields();
fields.screenshotMode = "webp";
syncFields();
fields.subOffsetStart = "-0.5";
syncFields();
currentContext = { startTime: 10, endTime: 15, text: "First Second", items: [
    { start: 10, end: 11, text: "First" }, { start: 12, end: 15, text: "Second" }
] };
const timed = media.buildSnapshot();
assert.equal(timed.audioStart, 10.5);
assert.equal(timed.targetTime, 10.5);
assert.equal(timed.imageSubtitleMode, undefined);
assert.equal(timed.imageSubtitleCues[0].start, 11);
currentContext.items[0].text = "Changed after capture";
requests.length = 0;
await media.updateNote(123, timed);
assert.equal(requests[0][0], "/animated-webp");
assert.deepEqual(requests[0][1].imageSubtitleCues, [
    { start: 11, end: 12, text: "First" }, { start: 13, end: 16, text: "Second" }
]);
includeImageSubtitle = false;
syncFields();
const hidden = media.buildSnapshot();
assert.equal(hidden.imageSubtitleCues.length, 2);
assert.equal(context.buildImageSubtitleExport(hidden).text, "");
assert.equal(context.buildImageSubtitleExport(hidden).imageSubtitleCues.length, 0);
includeImageSubtitle = true;
syncFields();
fields.imageSubtitleMode = "all";
syncFields();
requests.length = 0;
await media.updateNote(123, timed);
assert.equal(requests[0][1].imageSubtitleMode, "all");
fields.imageSubtitleMode = "timed";
syncFields();
requests.length = 0;
await media.updateNote(123, timed);
assert.equal(requests[0][1].imageSubtitleMode, "timed");
fields.pictureField = "";
syncFields();
fields.ankiUrl = "";
syncFields();
assert.throws(() => media.buildSnapshot());
assert.doesNotThrow(() => media.buildSnapshot({ validateAnki: false }));
console.log("Candidate media snapshot and manual validation tests passed");

dom.window.close();
