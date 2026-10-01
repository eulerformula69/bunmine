
export type SubtitleFormat = "srt" | "vtt" | "ass" | "ssa" | "unknown";

export interface SubtitleCue {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    format?: SubtitleFormat;
    rawText?: string;
    layer?: number;
    style?: string;
    alignment?: number;
    positionX?: number;
    positionY?: number;
    playResX?: number;
    playResY?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    bold?: boolean;
    italic?: boolean;
    metadata?: Readonly<Record<string, unknown>>;
}

export interface RuntimeSubtitleCue {
    start: number;
    end: number;
    text: string;
    layer?: number;
    style?: string;
    alignment?: number;
    positionX?: number;
    positionY?: number;
    playResX?: number;
    playResY?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    bold?: boolean;
    italic?: boolean;
    [key: string]: unknown;
}

export function toRuntimeSubtitleCue(cue: SubtitleCue): RuntimeSubtitleCue {
    return {
        start: cue.startTime,
        end: cue.endTime,
        text: cue.text,
        layer: cue.layer,
        style: cue.style,
        alignment: cue.alignment,
        positionX: cue.positionX,
        positionY: cue.positionY,
        playResX: cue.playResX,
        playResY: cue.playResY,
        fontName: cue.fontName,
        fontSize: cue.fontSize,
        primaryColor: cue.primaryColor,
        bold: cue.bold,
        italic: cue.italic
    };
}

export function toRuntimeSubtitleCues(cues: readonly SubtitleCue[]): RuntimeSubtitleCue[] {
    return cues.map(toRuntimeSubtitleCue);
}
