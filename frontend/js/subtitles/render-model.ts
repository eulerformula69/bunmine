import { RuntimeSubtitleCue } from "./model.js";

export interface SubtitleRenderModel {
    index: number;
    start: number;
    end: number;
    text: string;
    active: boolean;
}

export function buildSubtitleRenderModel(
    cue: RuntimeSubtitleCue,
    index: number,
    currentTime: number,
    delaySeconds: number
): SubtitleRenderModel {
    const adjustedTime = currentTime - delaySeconds;

    return {
        index,
        start: cue.start + delaySeconds,
        end: cue.end + delaySeconds,
        text: cue.text,
        active: adjustedTime >= cue.start && adjustedTime <= cue.end
    };
}
