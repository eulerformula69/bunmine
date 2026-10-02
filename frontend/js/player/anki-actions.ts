import { logger } from "../core/logger.js";
import { getApiErrorMessage } from "../core/api.js";
import { fetchDeckNoteIds,fetchNotesInfo } from "../anki/notes.js";

import { AnkiMediaSnapshot,buildImageSubtitleExport } from "../anki/media-snapshot.js";

import { CurrentVideoPayload } from "../types/runtime-types.js";

import { CandidateCue } from "./candidate-context-model.js";

import { buildApiUrl } from "../core/api.js";

import { boldWordInText,getNoteWord } from "../anki/note-fields.js";

import { buildSentenceFurigana } from "../anki/furigana.js";

import { ankiRequest } from "../anki/anki-connect-client.js";

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
            throw new Error(getApiErrorMessage(pictureData, getApiErrorMessage(audioData, "Media server error")));
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
                logger.warn("Furigana generation skipped:", error);
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

        await ankiRequest(snapshot.ankiUrl, "updateNoteFields", {
            note: { id: targetNoteId, fields }
        }, { retries: 0, timeoutMs: 5000 });

        options.resetRuntimeHighlightPrefetch();
        try {
            await options.refreshKnownWord({
                noteId: targetNoteId,
                word: targetWord,
                wordFields: options.getHighlightWordFields()
            });
        } catch (error) {
            logger.warn("Could not refresh known-anki-words.json for updated card:", error);
        }

        options.ensureSubtitleStatuses(snapshot.combinedText)
            .then(options.prefetchSubtitleStatuses)
            .catch((error) => logger.warn("Could not update runtime highlight status:", error));

        return { targetWord };
    }

    async function updateCurrentOrSelected(): Promise<void> {
        const snapshot = options.resolveExportSnapshot ? await options.resolveExportSnapshot() : buildSnapshot();
        const noteIds = await (options.fetchDeckNoteIds || fetchDeckNoteIds)(snapshot.ankiUrl, snapshot.deckName);
        if (!noteIds.length) {
            throw new Error(`Error: There are no cards in "${snapshot.deckName}"!`);
        }

        const targetNoteId = noteIds[noteIds.length - 1];
        await updateNote(targetNoteId, snapshot);
        options.showToast(options.translate("toastCardUpdated"), "success");
        options.maybePromptSubtitleDepthReset();
    }

    return { buildSnapshot, updateNote, updateCurrentOrSelected };
}
