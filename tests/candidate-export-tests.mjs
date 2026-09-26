import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const requests = [];
const ctx = vm.createContext({
    console, setTimeout, clearTimeout, AbortController,
    t: (key) => key,
    document: { getElementById: () => ({ value: "" }) },
    buildApiUrl: (path) => path,
    fetch: async (url, options) => {
        requests.push([url, JSON.parse(options.body)]);
        return { ok: true, json: async () => ({ filename: "media", result: null }) };
    },
});
for (const path of ["anki-actions", "candidate-export", "candidate-model", "auto-attach-controller"]) {
    vm.runInContext(fs.readFileSync(`dist/js/player/${path}.js`, "utf8"), ctx);
}
const stored = new Map([1, 2].map((id) => [id, {
    id, revision: 1, snapshot: {
        videoPayload: { videoFileId: id }, currentIdx: 142,
        audioStart: id * 10, audioEnd: id * 10 + 7,
        combinedText: `before word${id} after`, selectedWord: `word${id}`,
        imageSubtitleText: `before word${id} after`, targetTime: id * 10 + 2,
        imageSubtitleCues: [{ start: id * 10, end: id * 10 + 7, text: `word${id}` }],
        ankiUrl: "anki", deckName: "deck", pictureField: "Picture", audioField: "Audio",
        sentenceField: "Sentence", screenshotMode: "webp", trackIndex: "default", volumeLevel: 1,
    },
}]));
const exports = ctx.createCandidateExportService({
    source: async (id) => structuredClone(stored.get(id)), configure() {},
});
let activeId = 1;
ctx.candidateExports = exports;
ctx.candidatePanel = { exportCandidateId: () => activeId };
ctx.fetchDeckNoteIds = async () => [123];
ctx.fetchNotesInfo = async () => [{ fields: {} }];
const media = ctx.createAnkiMediaController({
    translate: String,
    resolveExportSnapshot: () => ctx.resolveAnkiExportSnapshot(),
    validateExportSnapshot: exports.validate,
    getVideoPayload: () => ({ videoFileId: 99 }), getVideoCurrentTime: () => 999,
    getValidatedVolume: () => 1, getActiveSubtitleIndex: () => 0,
    getSubtitleStart: () => 999,
    getSubtitleContext: () => ({ startTime: 999, endTime: 1000, text: "center only" }),
    getGlobalSubtitleDelay: () => 0, getTargetNoteId: () => 123,
    resetRuntimeHighlightPrefetch() {}, refreshKnownWord: async () => {},
    getHighlightWordFields: () => [], ensureSubtitleStatuses: async () => {},
    prefetchSubtitleStatuses() {}, showToast() {}, clearTargetNote() {},
    refreshTargetNotes() {}, maybePromptSubtitleDepthReset() {},
});
ctx.ankiMediaController = media;

// Manual update ignores the current video and exports all selected candidate cues.
await media.updateCurrentOrSelected();
assert.equal(requests[0][1].start, 10);
assert.equal(requests[0][1].end, 17);
assert.equal(requests[0][1].text, "before word1 after");
assert.equal(requests[1][1].end, 17);
assert.equal(requests[2][1].params.note.fields.Sentence, "before word1 after");

// Listener resolves the same candidate source and freezes its identity during the wait.
requests.length = 0;
let polls = 0;
const listener = ctx.createAutoAttachController({
    enabled: () => true, snapshot: ctx.resolveAnkiExportSnapshot,
    noteIds: async () => { activeId = 2; return ++polls === 1 ? [] : [123]; },
    verify: async () => {}, update: media.updateNote,
    exclusive: (work) => work(), sleep: async () => {}, now: () => 0,
    status() {}, done() {}, error(error) { throw error; },
});
await listener.start("word1", 999);
assert.equal(requests[0][1].videoFileId, 1);
assert.equal(requests[2][1].params.note.fields.Sentence, "before word1 after");

// Explicit IDs support export without an active panel (including a future batch caller).
activeId = undefined;
const snapshots = await Promise.all([1, 2].map(async (id) => (await exports.load(id)).snapshot));
assert.deepEqual(snapshots.map((s) => s.audioEnd), [17, 27]);
snapshots[0].imageSubtitleCues[0].text = "mutation";
assert.equal(stored.get(1).snapshot.imageSubtitleCues[0].text, "word1");

// Export waits for persistence of this ID; it does not block another candidate.
let finish;
exports.trackSave(1, new Promise((resolve) => { finish = resolve; }));
let loaded = false;
const pending = exports.load(1).then((value) => { loaded = true; return value; });
await exports.load(2);
assert.equal(loaded, false);
stored.get(1).revision++;
stored.get(1).snapshot.audioEnd = 19;
finish();
assert.equal((await pending).snapshot.audioEnd, 19);

// Stale snapshots and failed saves cannot silently export old boundaries.
requests.length = 0;
await assert.rejects(media.updateNote(123, snapshots[0]), /candidateContextChanged/);
assert.equal(requests.length, 0);
exports.trackSave(2, Promise.reject(new Error("save failed")));
await assert.rejects(exports.load(2), /save failed/);
exports.trackSave(2, Promise.resolve());
assert.equal((await exports.load(2)).snapshot.audioEnd, 27);
console.log("Candidate export: manual, listener, independent IDs, save wait, failure and revision checks passed");
