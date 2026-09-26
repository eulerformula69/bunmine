import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const fields = {
    screenshotMode: "current", pictureField: "Picture", audioField: "Audio", sentenceField: "Sentence",
    ankiUrl: "http://anki.test", deckName: "Japanese", fontSizeRange: "24", subOffsetStart: "0", subOffsetEnd: "0",
};
let currentContext = { startTime: 10, endTime: 15, text: "猫です。" };
const requests = [];
const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout,
    document: { getElementById: (id) => ({ value: fields[id] || "", checked: true }) },
    buildApiUrl: (url) => url,
    fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push([url, body]);
        return { ok: true, json: async () => ({ filename: url === "/screenshot" ? "image.jpg" : "audio.mp3", result: null }) };
    },
});
vm.runInContext(fs.readFileSync("dist/js/player/anki-actions.js", "utf8"), context);
context.fetchNotesInfo = async () => [{ noteId: 123, fields: { Expression: { value: "猫" } } }];
const media = context.createAnkiMediaController({
    translate: String,
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
fields.pictureField = "";
fields.ankiUrl = "";
assert.throws(() => media.buildSnapshot());
assert.doesNotThrow(() => media.buildSnapshot({ validateAnki: false }));
console.log("Candidate media snapshot and manual validation tests passed");
