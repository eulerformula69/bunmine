import assert from "node:assert/strict";
import { resolveExportFields } from "../dist/esm/anki/export-fields.js";

const note = { fields: Object.fromEntries([
    "Image", "Audio Sentence", "Word_Audio", "Example", "SentenceFurigana", "CustomSound"
].map(name => [name, { value: "" }])) };
const snapshot = { pictureField: "", audioField: "", sentenceField: "", sentenceFuriganaField: "" };
assert.deepEqual(resolveExportFields(note, snapshot), {
    pictureField: "Image", audioField: "Audio Sentence", wordAudioField: "Word_Audio",
    sentenceField: "Example", sentenceFuriganaField: "SentenceFurigana"
});
assert.equal(resolveExportFields(note, { ...snapshot, wordAudioField: "CustomSound" }).wordAudioField, "CustomSound");
assert.throws(() => resolveExportFields(note, { ...snapshot, wordAudioField: "Missing" }), /does not exist/);
assert.throws(() => resolveExportFields(note, { ...snapshot, wordAudioField: "Image" }), /assigned twice/);
assert.throws(() => resolveExportFields({ fields: { WordAudio: { value: "" } } }, snapshot), /sentence audio/);
assert.equal(resolveExportFields({ fields: { Image: {}, SentenceAudio: {} } }, snapshot).wordAudioField, "");
console.log("Anki export field selection tests passed");
