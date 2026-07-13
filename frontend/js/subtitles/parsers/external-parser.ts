interface ExternalSubtitleCue {
    id?: string;
    startTime: number;
    endTime: number;
    text: string;
    rawText?: string;
    attributes?: Readonly<Record<string, unknown>>;
}

type ExternalSubtitleLoader = (
    input: SubtitleParseInput
) => Promise<readonly ExternalSubtitleCue[]>;

function mapExternalSubtitleCues(
    cues: readonly ExternalSubtitleCue[],
    format: SubtitleFormat
): SubtitleCueDraft[] {
    return cues.map((cue) => ({
        id: cue.id,
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: cue.text,
        rawText: cue.rawText,
        format,
        metadata: cue.attributes
    }));
}

class ExternalSubtitleParser implements SubtitleParser {
    readonly id: string;
    private readonly formats: ReadonlySet<SubtitleFormat>;
    private readonly load: ExternalSubtitleLoader;

    constructor(
        id: string,
        formats: readonly SubtitleFormat[],
        load: ExternalSubtitleLoader
    ) {
        this.id = id;
        this.formats = new Set(formats);
        this.load = load;
    }

    supports(format: SubtitleFormat): boolean {
        return this.formats.has(format);
    }

    async parse(input: SubtitleParseInput): Promise<SubtitleParseResult> {
        const externalCues = await this.load(input);
        const normalized = normalizeSubtitleCues(mapExternalSubtitleCues(externalCues, input.format), input.format);
        return { ...normalized, format: input.format };
    }
}
