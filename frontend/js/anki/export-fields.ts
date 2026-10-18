import type { AnkiNoteInfo } from "./notes.js";
import type { AnkiMediaSnapshot } from "./media-snapshot.js";

const fallbackNames = {
    pictureField: ["Picture", "Image", "Screenshot", "画像"],
    audioField: ["SentenceAudio", "AudioSentence", "SentenceSound", "例文音声", "文音声"],
    wordAudioField: ["WordAudio", "AudioWord", "ExpressionAudio", "VocabularyAudio", "Audio", "音声", "単語音声"],
    sentenceField: ["Sentence", "Example", "ExpressionSentence", "Context", "例文"],
    sentenceFuriganaField: ["SentenceReading", "SentenceFurigana", "例文読み", "例文ふりがな"]
};

export function resolveExportFields(note: AnkiNoteInfo | undefined, snapshot: AnkiMediaSnapshot) {
    const names = Object.keys(note?.fields || {});
    const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]/g, "");
    const used = new Set<string>();
    const result = {} as Record<keyof typeof fallbackNames, string>;
    for (const key of Object.keys(fallbackNames) as Array<keyof typeof fallbackNames>) {
        const configured = snapshot[key]?.trim();
        let field = "";
        if (configured) {
            if (!names.includes(configured)) throw new Error(`Anki field does not exist: ${configured}`);
            field = configured;
        } else {
            for (const alias of fallbackNames[key]) {
                field = names.find((name) => !used.has(name) && normalize(name) === normalize(alias)) || "";
                if (field) break;
            }
        }
        if (field && used.has(field)) throw new Error(`Anki field is assigned twice: ${field}`);
        if (field) used.add(field);
        result[key] = field;
    }
    if (!result.pictureField || !result.audioField) {
        throw new Error("Set the picture and sentence audio fields in the player settings.");
    }
    return result;
}
