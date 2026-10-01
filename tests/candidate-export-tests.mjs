import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();

await import("../dist/esm/player/sidebar-i18n.js");
const ctx = Object.assign({}, ...await Promise.all(["anki-actions", "candidate-export", "candidate-model", "auto-attach-controller"].map(name => import('../dist/esm/player/' + name + '.js'))));
const {t} = await import("../dist/esm/player/ui.js");
const requests = [];
globalThis.fetch = async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return new Response(JSON.stringify({ filename: "media", result: null }));
};
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
document.getElementById("imageSubtitleMode").value = "all";
document.getElementById("includeImageSubtitle").checked = true;
const exports = ctx.createCandidateExportService({
    source: async (id) => structuredClone(stored.get(id)),
    configure() {},
});
let activeId = 1;
ctx.resolveAnkiExportSnapshot = async () => (await exports.load(activeId)).snapshot;
ctx.candidatePanel = { exportCandidateId: () => activeId };
ctx.fetchDeckNoteIds = async () => [123];
ctx.fetchNotesInfo = async () => [{ fields: {} }];
const media = ctx.createAnkiMediaController({
    translate: String,
    fetchNotesInfo: ctx.fetchNotesInfo, fetchDeckNoteIds: ctx.fetchDeckNoteIds,
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

// A mode change must apply to an existing candidate, including one saved without image text.
const original = stored.get(1).snapshot;
original.imageSubtitleMode = "all";
original.imageSubtitleText = "";
original.imageSubtitleCues = [];
original.imageSubtitleDelay = 1;
original.context = { start: 0, end: 2, anchor: 1, cues: [
    { start: 9, end: 11, text: "before" },
    { start: 12, end: 14, text: "word1" },
    { start: 14, end: 16, text: "after" },
] };
document.getElementById("imageSubtitleMode").value = "timed";
requests.length = 0;
await media.updateCurrentOrSelected();
assert.equal(requests[0][1].imageSubtitleMode, "timed");
assert.deepEqual(requests[0][1].imageSubtitleCues, [
    { start: 10, end: 12, text: "before" },
    { start: 13, end: 15, text: "word1" },
    { start: 15, end: 17, text: "after" },
]);
assert.equal(requests[2][1].params.note.fields.Sentence, "before word1 after");
assert.equal(original.imageSubtitleMode, "all");
assert.equal(original.imageSubtitleCues.length, 0);
document.getElementById("includeImageSubtitle").checked = false;
const disabled = ctx.buildImageSubtitleExport((await exports.load(1)).snapshot);
assert.equal(disabled.text, "");
assert.equal(disabled.imageSubtitleCues.length, 0);
document.getElementById("includeImageSubtitle").checked = true;
document.getElementById("imageSubtitleMode").value = "all";
assert.equal(ctx.buildImageSubtitleExport((await exports.load(1)).snapshot).imageSubtitleMode, "all");
document.getElementById("imageSubtitleMode").value = "timed";
const old = { combinedText: "legacy", imageSubtitleText: "legacy" };
assert.throws(() => ctx.buildImageSubtitleExport(old), { message: t("candidateSubtitleTimingMissing") });
document.getElementById("imageSubtitleMode").value = "all";
assert.doesNotThrow(() => ctx.buildImageSubtitleExport(old));
document.getElementById("imageSubtitleMode").value = "timed";

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
assert.equal(requests[0][1].imageSubtitleMode, "timed");
assert.equal(requests[2][1].params.note.fields.Sentence, "before word1 after");

// Explicit IDs support export without an active panel (including a future batch caller).
activeId = undefined;
const snapshots = await Promise.all([1, 2].map(async (id) => (await exports.load(id)).snapshot));
assert.deepEqual(snapshots.map((s) => s.audioEnd), [17, 27]);
snapshots[0].context.cues[0].text = "mutation";
assert.equal(stored.get(1).snapshot.context.cues[0].text, "before");

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
await assert.rejects(media.updateNote(123, snapshots[0]), { message: t("candidateContextChanged") });
assert.equal(requests.length, 0);
exports.trackSave(2, Promise.reject(new Error("save failed")));
await assert.rejects(exports.load(2), /save failed/);
exports.trackSave(2, Promise.resolve());
assert.equal((await exports.load(2)).snapshot.audioEnd, 27);
console.log("Candidate export: manual, listener, independent IDs, save wait, failure and revision checks passed");

dom.window.close();
