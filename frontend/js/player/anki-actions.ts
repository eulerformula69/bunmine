import { CurrentVideoPayload } from "../types/runtime-types.js";
import { buildApiUrl, fetchWithRetry } from "../core/api.js";
import { tokenizeJapaneseText } from "../japanese/japanese-tokenizer.js";
import { CandidateContext, CandidateCue } from "./candidate-context-model.js";
import { t } from "./ui.js";
export interface AnkiMediaSnapshotDraft {
    videoPayload: CurrentVideoPayload;
    subtitleIndex: number;
    selectedWord: string;
    sentence: string;
    audioStart: number;
    audioEnd: number;
    volume: number;
}

export function hasRequiredAnkiMediaFields(fields: {
    pictureField?: string;
    audioField?: string;
}): boolean {
    return Boolean(fields.pictureField?.trim() && fields.audioField?.trim());
}

export function normalizeSelectedAnkiWord(word: string): string {
    return String(word || "").trim();
}

export interface AnkiConnectResponse<T> {
    error?: string;
    result?: T;
}

export async function fetchDeckNoteIds(ankiUrl: string, deckName: string): Promise<number[]> {
    const findRes = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "findNotes",
            version: 6,
            params: {
                query: `deck:"${deckName}"`
            }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label: "AnkiConnect findNotes"
    });

    const findData = await findRes.json() as AnkiConnectResponse<number[]>;

    if (findData.error) throw new Error(findData.error);

    return Array.isArray(findData.result) ? findData.result : [];
}

export async function fetchNoteIdsByQuery(
    ankiUrl: string,
    query: string,
    label = "AnkiConnect findNotes"
): Promise<number[]> {
    const findRes = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "findNotes",
            version: 6,
            params: { query }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label
    });

    const findData = await findRes.json() as AnkiConnectResponse<number[]>;

    if (findData.error) throw new Error(findData.error);

    return Array.isArray(findData.result) ? findData.result : [];
}

export async function fetchNotesInfo(
    ankiUrl: string,
    noteIds: Array<string | number>
): Promise<Array<{ noteId?: string | number; fields?: Record<string, { value?: unknown }> }>> {
    const res = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "notesInfo",
            version: 6,
            params: {
                notes: noteIds
            }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label: "AnkiConnect notesInfo"
    });

    const data = await res.json() as AnkiConnectResponse<Array<{ noteId?: string | number; fields?: Record<string, { value?: unknown }> }>>;

    if (data.error) throw new Error(data.error);

    return Array.isArray(data.result) ? data.result : [];
}

export function stripHtml(input: unknown): string {
    return String(input || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function isKanaOnly(text: string): boolean {
    return /^[\u3040-\u309f\u30a0-\u30ffー]+$/.test(String(text || ""));
}

export function hasKanji(text: string): boolean {
    return /[\u3400-\u9fff]/.test(String(text || ""));
}

export function normalizeAnkiFuriganaWhitespace(text: string): string {
    return String(text || "").replace(
        /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g,
        " "
    );
}

export function encodeAnkiFuriganaSpaces(text: string): string {
    return String(text || "").replace(/ /g, "&nbsp;");
}

export function escapeAnkiFieldText(text: string): string {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}

export function splitKanjiStemAndKanaTail(surface: string, readingHiragana: string): {
    stem: string;
    tail: string;
    stemReading: string;
} {
    const match = String(surface || "").match(/^(.+?)([\u3040-\u309f]+)$/);

    if (!match) {
        return {
            stem: surface,
            tail: "",
            stemReading: readingHiragana
        };
    }

    const stem = match[1];
    const tail = match[2];

    if (!hasKanji(stem)) {
        return {
            stem: surface,
            tail: "",
            stemReading: readingHiragana
        };
    }

    if (readingHiragana.endsWith(tail)) {
        return {
            stem,
            tail,
            stemReading: readingHiragana.slice(0, -tail.length)
        };
    }

    return {
        stem: surface,
        tail: "",
        stemReading: readingHiragana
    };
}

export function escapeRegExp(text: string): string {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function boldWordInText(text: string, word: string): string {
    const source = String(text || "");
    const target = stripHtml(word);

    if (!target) return source;

    const pattern = new RegExp(`${escapeRegExp(target)}(\\[[^\\]]+\\])?`, "g");

    return source.replace(pattern, (match) => `<b>${match}</b>`);
}

export function getNoteWord(noteInfo: { fields?: Record<string, { value?: unknown }> } | null | undefined): string {
    const fields = noteInfo?.fields || {};
    const wordFieldNames = (
        (document.getElementById("highlightWordField") as HTMLInputElement | null)?.value || "Word"
    )
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

    for (const fieldName of wordFieldNames) {
        const word = stripHtml(fields[fieldName]?.value);
        if (word) return word;
    }

    return "";
}

export async function buildSentenceFurigana(text: string): Promise<string> {
    // Anki's bracket-furigana parser only treats an ASCII space as a reliable
    // reading-group separator. Subtitle formats commonly contain visually
    // identical full-width or non-breaking spaces, so normalize them before
    // token positions and separators are copied into the generated field.
    const source = normalizeAnkiFuriganaWhitespace(text);

    if (!source) return "";

    const tokens = await tokenizeJapaneseText(source);
    let result = "";
    let lastEnd = 0;

    for (const token of tokens) {
        const surface = token.surface_form || "";
        const reading = token.reading || "";

        if (!surface) continue;

        const start = Math.max(0, Number(token.word_position || 1) - 1);
        const end = start + surface.length;

        if (start > lastEnd) {
            result += source.slice(lastEnd, start);
        }

        const previousChar = result.slice(-1);
        const shouldAddSpaceBeforeKanjiWord =
            hasKanji(surface) &&
            result &&
            previousChar &&
            !/\s/.test(previousChar) &&
            !/[（(「『【［]/.test(previousChar);

        if (shouldAddSpaceBeforeKanjiWord) {
            result += " ";
        }

        if (!hasKanji(surface) || !reading) {
            result += surface;
            lastEnd = end;
            continue;
        }

        const hiraganaReading = katakanaToHiragana(reading);
        const { stem, tail, stemReading } = splitKanjiStemAndKanaTail(surface, hiraganaReading);

        if (!stemReading) {
            result += surface;
            lastEnd = end;
            continue;
        }

        result += `${stem}[${stemReading}]${tail}`;
        lastEnd = end;
    }

    if (lastEnd < source.length) {
        result += source.slice(lastEnd);
    }

    // Anki fields are HTML. Literal spaces sent through AnkiConnect can be
    // collapsed before the furigana filter sees them, while a space retyped in
    // Anki's editor is stored as &nbsp;. Emit the same stable separator here.
    return encodeAnkiFuriganaSpaces(result);
}

export function katakanaToHiragana(text: string): string {
    return String(text || "").replace(/[\u30a1-\u30f6]/g, (char) => {
        return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
}

export function pickNotePreviewText(noteInfo: { fields?: Record<string, { value?: unknown }> } | null | undefined): string {
    const fields = noteInfo?.fields || {};
    const preferredFieldOrder = [
        "Word", "Key", "Expression", "Sentence", "Front", "Back", "Meaning", "Definition"
    ];

    for (const key of preferredFieldOrder) {
        const value = stripHtml(fields[key]?.value);
        if (value) return value;
    }

    for (const field of Object.values(fields)) {
        const value = stripHtml(field?.value);
        if (value) return value;
    }

    return "";
}

export interface AnkiMediaSnapshot {
    candidateId?: number;
    candidateRevision?: number;
    context?: CandidateContext;
    videoPayload: CurrentVideoPayload;
    volumeLevel: number;
    ankiUrl: string;
    deckName: string;
    screenshotMode: string;
    sentenceField: string;
    pictureField: string;
    audioField: string;
    sentenceFuriganaField?: string;
    currentIdx: number;
    targetTime: number;
    audioStart: number;
    audioEnd: number;
    combinedText: string;
    imageSubtitleText: string;
    imageSubtitleCues?: CandidateCue[];
    imageSubtitleDelay?: number;
    fontSize: string;
    trackIndex: string;
    selectedWord?: string;
}

export function buildImageSubtitleExport(snapshot: AnkiMediaSnapshot) {
    const mode = (document.getElementById("imageSubtitleMode") as HTMLButtonElement | null)?.value === "timed"
        ? "timed" : "all";
    const enabled = (document.getElementById("includeImageSubtitle") as HTMLInputElement | null)?.checked !== false;
    let cues = snapshot.imageSubtitleCues || [];
    if (snapshot.context) {
        const { cues: source, start, end } = snapshot.context;
        const delay = snapshot.imageSubtitleDelay || 0;
        cues = source.slice(start, end + 1).map((cue) => ({
            start: cue.start + delay, end: cue.end + delay, text: cue.text
        }));
    }
    if (enabled && mode === "timed" && !cues.length) {
        throw new Error(t("candidateSubtitleTimingMissing"));
    }
    return {
        imageSubtitleMode: mode,
        text: enabled ? snapshot.combinedText : "",
        imageSubtitleCues: enabled ? cues : []
    };
}

export interface AnkiMediaControllerOptions {
    fetchNotesInfo?: typeof fetchNotesInfo;
    fetchDeckNoteIds?: typeof fetchDeckNoteIds;
    resolveExportSnapshot?(): Promise<AnkiMediaSnapshot>;
    validateExportSnapshot?(snapshot: AnkiMediaSnapshot): Promise<void>;
    translate(key: string, params?: Record<string, unknown>): string;
    getVideoPayload(): CurrentVideoPayload | null;
    getVideoCurrentTime(): number;
    getValidatedVolume(): number;
    getActiveSubtitleIndex(): number;
    getSubtitleStart(index: number): number;
    getSubtitleContext(index: number): { startTime: number; endTime: number; text: string; items?: CandidateCue[] };
    getGlobalSubtitleDelay(): number;
    getTargetNoteId(): number;
    clearTargetNote(): void;
    refreshTargetNotes(): void;
    maybePromptSubtitleDepthReset(): void;
    resetRuntimeHighlightPrefetch(): void;
    refreshKnownWord(payload: Record<string, unknown>): Promise<unknown> | undefined;
    getHighlightWordFields(): string[] | undefined;
    ensureSubtitleStatuses(text: string): Promise<unknown>;
    prefetchSubtitleStatuses(): void;
    showToast(message: string, type?: string, duration?: number): unknown;
}

export interface AnkiMediaController {
    buildSnapshot(options?: { subtitleIndex?: number | null; validateAnki?: boolean }): AnkiMediaSnapshot;
    updateNote(targetNoteId: number, snapshot: AnkiMediaSnapshot): Promise<{ targetWord: string }>;
    updateCurrentOrSelected(): Promise<void>;
}

export function createAnkiMediaController(options: AnkiMediaControllerOptions): AnkiMediaController {
    const inputValue = (id: string): string =>
        (document.getElementById(id) as HTMLInputElement | null)?.value || "";

    function buildSnapshot({ subtitleIndex = null, validateAnki = true } = {}): AnkiMediaSnapshot {
        const videoPayload = options.getVideoPayload();
        if (!videoPayload) throw new Error(options.translate("toastVideoNotUploaded"));

        const offsetStart = parseFloat(inputValue("subOffsetStart")) || 0;
        const offsetEnd = parseFloat(inputValue("subOffsetEnd")) || 0;
        const ankiUrl = inputValue("ankiUrl");
        const deckName = inputValue("deckName");
        const screenshotMode = inputValue("screenshotMode");
        const sentenceField = inputValue("sentenceField").trim();
        const pictureField = inputValue("pictureField").trim();
        const audioField = inputValue("audioField").trim();
        const sentenceFuriganaField = inputValue("sentenceFuriganaField").trim();

        if (validateAnki && (!pictureField || !audioField)) {
            throw new Error(options.translate("toastRequiredFields"));
        }
        if (validateAnki && (!ankiUrl || !deckName)) {
            throw new Error(options.translate("toastAnkiSettingsRequired"));
        }

        const currentIdx = Number.isInteger(subtitleIndex)
            ? Number(subtitleIndex)
            : options.getActiveSubtitleIndex();
        if (currentIdx === -1) throw new Error(options.translate("toastNoActiveSubtitle"));

        const globalDelay = options.getGlobalSubtitleDelay();
        const targetTime = screenshotMode === "current"
            ? options.getVideoCurrentTime()
            : Math.max(0, options.getSubtitleStart(currentIdx) + globalDelay + offsetStart);
        const context = options.getSubtitleContext(currentIdx);
        const audioStart = Math.max(0, context.startTime + globalDelay + offsetStart);
        let audioEnd = context.endTime + globalDelay + offsetEnd;
        if (audioEnd <= audioStart) audioEnd = audioStart + 0.5;

        return {
            videoPayload,
            volumeLevel: options.getValidatedVolume(),
            ankiUrl,
            deckName,
            screenshotMode,
            sentenceField,
            pictureField,
            audioField,
            sentenceFuriganaField,
            currentIdx,
            targetTime,
            audioStart,
            audioEnd,
            combinedText: context.text,
            imageSubtitleText: context.text,
            imageSubtitleDelay: globalDelay,
            imageSubtitleCues: (context.items || []).map((cue) => ({
                start: cue.start + globalDelay, end: cue.end + globalDelay, text: cue.text
            })),
            fontSize: inputValue("fontSizeRange"),
            trackIndex: "default"
        };
    }

    async function updateNote(
        targetNoteId: number,
        snapshot: AnkiMediaSnapshot
    ): Promise<{ targetWord: string }> {
        await options.validateExportSnapshot?.(snapshot);
        const imageSubtitles = buildImageSubtitleExport(snapshot);
        const pictureEndpoint = snapshot.screenshotMode === "webp"
            ? "/animated-webp"
            : "/screenshot";
        const picturePayload = snapshot.screenshotMode === "webp"
            ? {
                ...snapshot.videoPayload,
                start: snapshot.audioStart,
                end: snapshot.audioEnd,
                ...imageSubtitles,
                fontSize: snapshot.fontSize
            }
            : {
                ...snapshot.videoPayload,
                time: snapshot.targetTime,
                ...imageSubtitles,
                fontSize: snapshot.fontSize
            };

        const [pictureResponse, audioResponse] = await Promise.all([
            fetch(buildApiUrl(pictureEndpoint), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(picturePayload)
            }),
            fetch(buildApiUrl("/audio-to-anki"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...snapshot.videoPayload,
                    start: snapshot.audioStart,
                    end: snapshot.audioEnd,
                    trackIndex: snapshot.trackIndex,
                    volume: snapshot.volumeLevel
                })
            })
        ]);
        const pictureData = await pictureResponse.json();
        const audioData = await audioResponse.json();

        if (!pictureResponse.ok || !audioResponse.ok) {
            throw new Error(pictureData.error || audioData.error || "Media server error");
        }

        const [targetNoteInfo] = await (options.fetchNotesInfo || fetchNotesInfo)(snapshot.ankiUrl, [targetNoteId]);
        const targetWord = getNoteWord(targetNoteInfo);
        const sentence = targetWord
            ? boldWordInText(snapshot.combinedText, targetWord)
            : snapshot.combinedText;
        let furiganaSentence = "";

        if (snapshot.sentenceFuriganaField) {
            try {
                furiganaSentence = boldWordInText(
                    await Promise.race([
                        buildSentenceFurigana(snapshot.combinedText),
                        new Promise<string>((_, reject) => setTimeout(
                            () => reject(new Error("Furigana generation timeout")),
                            1500
                        ))
                    ]),
                    targetWord
                );
            } catch (error) {
                console.warn("Furigana generation skipped:", error);
            }
        }

        const fields: Record<string, string> = {
            [snapshot.pictureField]: `<img src="${pictureData.filename}">`,
            [snapshot.audioField]: `[sound:${audioData.filename}]`
        };
        if (snapshot.sentenceField) fields[snapshot.sentenceField] = sentence;
        if (snapshot.sentenceFuriganaField) {
            fields[snapshot.sentenceFuriganaField] = furiganaSentence;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let updateResponse: Response;

        try {
            updateResponse = await fetch(snapshot.ankiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    action: "updateNoteFields",
                    version: 6,
                    params: { note: { id: targetNoteId, fields } }
                })
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const updateData = await updateResponse.json();
        if (!updateResponse.ok || updateData.error) {
            throw new Error(updateData.error || `Anki update failed: HTTP ${updateResponse.status}`);
        }

        options.resetRuntimeHighlightPrefetch();
        try {
            await options.refreshKnownWord({
                noteId: targetNoteId,
                word: targetWord,
                wordFields: options.getHighlightWordFields()
            });
        } catch (error) {
            console.warn("Could not refresh known-anki-words.json for updated card:", error);
        }

        options.ensureSubtitleStatuses(snapshot.combinedText)
            .then(options.prefetchSubtitleStatuses)
            .catch((error) => console.warn("Could not update runtime highlight status:", error));

        return { targetWord };
    }

    async function updateCurrentOrSelected(): Promise<void> {
        const snapshot = options.resolveExportSnapshot ? await options.resolveExportSnapshot() : buildSnapshot();
        const noteIds = await (options.fetchDeckNoteIds || fetchDeckNoteIds)(snapshot.ankiUrl, snapshot.deckName);
        if (!noteIds.length) {
            throw new Error(`Error: There are no cards in "${snapshot.deckName}"!`);
        }

        const selectedId = options.getTargetNoteId();
        const targetNoteId = selectedId > 0 ? selectedId : noteIds[noteIds.length - 1];
        await updateNote(targetNoteId, snapshot);
        options.showToast(options.translate("toastCardUpdated"), "success");
        options.clearTargetNote();
        options.refreshTargetNotes();
        options.maybePromptSubtitleDepthReset();
    }

    return { buildSnapshot, updateNote, updateCurrentOrSelected };
}
