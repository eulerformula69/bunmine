interface SubtitleParseInput {
    source: string;
    format: SubtitleFormat;
    filename?: string;
}

interface SubtitleParseWarning {
    code: string;
    message: string;
    cueIndex?: number;
}

interface SubtitleParseResult {
    cues: SubtitleCue[];
    format: SubtitleFormat;
    warnings: SubtitleParseWarning[];
}

interface SubtitleParser {
    readonly id: string;
    supports(format: SubtitleFormat): boolean;
    parse(input: SubtitleParseInput): Promise<SubtitleParseResult>;
}

class SubtitleParseError extends Error {
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
