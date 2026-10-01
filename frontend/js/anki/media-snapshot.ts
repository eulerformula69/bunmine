import { CandidateContext,CandidateCue } from "../player/candidate-context-model.js";

import { CurrentVideoPayload } from "../types/runtime-types.js";

import { t } from "../core/translate.js";

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
