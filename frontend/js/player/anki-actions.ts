import { logger } from "../core/logger.js";
import { getApiErrorMessage } from "../core/api.js";
import { fetchNotesInfo } from "../anki/notes.js";

import { AnkiMediaSnapshot,buildImageSubtitleExport } from "../anki/media-snapshot.js";

import { CurrentVideoPayload } from "../types/runtime-types.js";

import { CandidateCue } from "./candidate-context-model.js";

import { buildApiUrl } from "../core/api.js";

import { boldWordInText,getNoteWord } from "../anki/note-fields.js";

import { buildSentenceFurigana } from "../anki/furigana.js";
import { getSubtitleDisplayText } from "../subtitles/display-text.js";

import { ankiRequest } from "../anki/anki-connect-client.js";
import { resolveExportFields } from "../anki/export-fields.js";

export interface AnkiMediaControllerOptions {
    fetchNotesInfo?: typeof fetchNotesInfo;
    validateExportSnapshot?(snapshot: AnkiMediaSnapshot): Promise<void>;
    translate(key: string, params?: Record<string, unknown>): string;
    getVideoPayload(): CurrentVideoPayload | null;
    getVideoCurrentTime(): number;
    getValidatedVolume(): number;
    getActiveSubtitleIndex(): number;
    getSubtitleStart(index: number): number;
    getSubtitleContext(index: number): { startTime: number; endTime: number; text: string; items?: CandidateCue[] };
    getGlobalSubtitleDelay(): number;
    resetRuntimeHighlightPrefetch(): void;
    refreshKnownWord(payload: Record<string, unknown>): Promise<unknown> | undefined;
    getHighlightWordFields(): string[] | undefined;
    ensureSubtitleStatuses(text: string): Promise<unknown>;
    prefetchSubtitleStatuses(): void;
}

export interface AnkiMediaController {
    buildSnapshot(options?: { subtitleIndex?: number | null; validateAnki?: boolean }): AnkiMediaSnapshot;
    updateNote(targetNoteId: number, snapshot: AnkiMediaSnapshot): Promise<{ targetWord: string }>;
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
        const wordAudioField = inputValue("wordAudioField").trim();
        const sentenceFuriganaField = inputValue("sentenceFuriganaField").trim();

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
            wordAudioField,
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
        const [targetNoteInfo] = await (options.fetchNotesInfo || fetchNotesInfo)(snapshot.ankiUrl, [targetNoteId]);
        const resolved = resolveExportFields(targetNoteInfo, snapshot);
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

        const targetWord = getNoteWord(targetNoteInfo);
        const exportText = getSubtitleDisplayText(snapshot.combinedText);
        const sentence = targetWord
            ? boldWordInText(exportText, targetWord)
            : exportText;
        let furiganaSentence = "";

        if (resolved.sentenceFuriganaField) {
            try {
                furiganaSentence = boldWordInText(
                    await Promise.race([
                        buildSentenceFurigana(exportText),
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
            [resolved.pictureField]: `<img src="${pictureData.filename}">`,
            [resolved.audioField]: `[sound:${audioData.filename}]`
        };
        const wordAudioField = resolved.wordAudioField;
        const existingWordAudio = wordAudioField ? targetNoteInfo?.fields?.[wordAudioField]?.value : "";
        if (wordAudioField && targetWord && !/\[sound:[^\]]+\]|<audio\b/i.test(String(existingWordAudio || ""))) {
            const response = await fetch(buildApiUrl("/word-audio"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: targetWord })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(getApiErrorMessage(data, "Word audio generation failed"));
            fields[wordAudioField] = `[sound:${data.filename}]`;
        }
        if (resolved.sentenceField) fields[resolved.sentenceField] = sentence;
        if (resolved.sentenceFuriganaField) {
            fields[resolved.sentenceFuriganaField] = furiganaSentence;
        }

        await ankiRequest(snapshot.ankiUrl, "updateNoteFields", {
            note: { id: targetNoteId, fields }
        }, { retries: 0, timeoutMs: 5000 });

        options.resetRuntimeHighlightPrefetch();
        void Promise.resolve().then(() => options.refreshKnownWord({
                noteId: targetNoteId,
                word: targetWord,
                wordFields: options.getHighlightWordFields()
            })).catch((error) => {
            logger.warn("Could not refresh known-anki-words.json for updated card:", error);
        });

        options.ensureSubtitleStatuses(exportText)
            .then(options.prefetchSubtitleStatuses)
            .catch((error) => logger.warn("Could not update runtime highlight status:", error));

        return { targetWord };
    }

    return { buildSnapshot, updateNote };
}
