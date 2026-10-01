import { SubtitleCue, SubtitleFormat } from "./model.js";
export interface SubtitleParseInput {
    source: string;
    format: SubtitleFormat;
    filename?: string;
}

export interface SubtitleParseWarning {
    code: string;
    message: string;
    cueIndex?: number;
}

export interface SubtitleParseResult {
    cues: SubtitleCue[];
    format: SubtitleFormat;
    warnings: SubtitleParseWarning[];
}

export interface SubtitleParser {
    readonly id: string;
    supports(format: SubtitleFormat): boolean;
    parse(input: SubtitleParseInput): Promise<SubtitleParseResult>;
}

export class SubtitleParseError extends Error {
    readonly code: string;
    readonly format?: SubtitleFormat;
    readonly cause?: unknown;

    constructor(
        code: string,
        message: string,
        options: { format?: SubtitleFormat; cause?: unknown } = {}
    ) {
        super(message);
        this.name = "SubtitleParseError";
        this.code = code;
        this.format = options.format;
        this.cause = options.cause;
    }
}

export function isSubtitleProviderCompatibilityError(error: SubtitleParseError): boolean {
    return error.code === "external-format-incompatible" || error.code === "external-empty-result";
}
