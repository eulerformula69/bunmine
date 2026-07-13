interface MediaCaptionsLibraryCue {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    vertical: string;
    snapToLines: boolean;
    line: number | "auto";
    lineAlign: string;
    position: number | "auto";
    positionAlign: string;
    size: number;
    align: string;
    region: { id?: string } | null;
    style?: Record<string, string>;
}

interface MediaCaptionsLibraryError {
    code: number;
    message: string;
    line: number;
}

interface MediaCaptionsLibraryResult {
    metadata: Readonly<Record<string, unknown>>;
    cues: MediaCaptionsLibraryCue[];
    errors: MediaCaptionsLibraryError[];
}

interface MediaCaptionsBrowserApi {
    parseText(source: string, options: {
        type: "srt" | "vtt" | "ass" | "ssa";
        strict: boolean;
        errors: boolean;
    }): Promise<MediaCaptionsLibraryResult>;
}

declare const MediaCaptions: MediaCaptionsBrowserApi;

class MediaCaptionsSubtitleParser implements SubtitleParser {
    readonly id = "media-captions";

    supports(format: SubtitleFormat): boolean {
        return format === "srt" || format === "vtt" || format === "ass" || format === "ssa";
    }

    async parse(input: SubtitleParseInput): Promise<SubtitleParseResult> {
        if (!this.supports(input.format)) {
            throw new SubtitleParseError("unsupported-format", `Unsupported subtitle format: ${input.format}`, {
                format: input.format
            });
        }

        const format = input.format as "srt" | "vtt" | "ass" | "ssa";
        const result = await MediaCaptions.parseText(input.source, {
            type: format,
            strict: false,
            errors: true
        });
        const warnings = result.errors.map((error) => ({
            code: `media-captions-${error.code}`,
            message: `${error.message} (line ${error.line})`
        }));

        if (!result.cues.length && input.source.trim()) {
            throw new SubtitleParseError(
                result.errors.length ? "external-format-incompatible" : "external-empty-result",
                "media-captions could not produce subtitle cues",
                { format, cause: result.errors }
            );
        }

        const assMetadata = format === "ass" || format === "ssa"
            ? extractMediaCaptionsAssMetadata(input.source, format)
            : [];
        const usedAssMetadata = new Set<number>();
        const drafts = result.cues
            .map((cue) => {
                const assCue = matchMediaCaptionsAssMetadata(
                    assMetadata,
                    cue.startTime,
                    cue.endTime,
                    usedAssMetadata
                );
                return mapMediaCaptionsCue(cue, format, assCue);
            })
            .filter((draft): draft is SubtitleCueDraft => draft !== null);
        const normalized = normalizeSubtitleCues(drafts, format);
        return { cues: normalized.cues, format, warnings: [...warnings, ...normalized.warnings] };
    }
}

function mapMediaCaptionsCue(
    cue: MediaCaptionsLibraryCue,
    format: SubtitleFormat,
    assCue?: MediaCaptionsAssCueMetadata
): SubtitleCueDraft | null {
    const assText = assCue ? extractMediaCaptionsAssText(assCue.rawText) : undefined;
    if (assText?.hasDrawingMode && !assText.text) return null;

    const providerMetadata: Record<string, unknown> = {
        provider: "media-captions",
        settings: {
            vertical: cue.vertical,
            snapToLines: cue.snapToLines,
            line: cue.line,
            lineAlign: cue.lineAlign,
            position: cue.position,
            positionAlign: cue.positionAlign,
            size: cue.size,
            align: cue.align,
            regionId: cue.region?.id
        }
    };
    if (cue.style) providerMetadata.style = { ...cue.style };

    return {
        id: cue.id || undefined,
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: cleanMediaCaptionsText(assText?.hasDrawingMode ? assText.text : cue.text),
        rawText: assCue?.rawText ?? cue.text,
        format,
        layer: assCue?.layer,
        style: assCue?.style,
        alignment: assCue?.alignment,
        positionX: assCue?.positionX,
        positionY: assCue?.positionY,
        playResX: assCue?.playResX,
        playResY: assCue?.playResY,
        fontName: assCue?.fontName ?? readMediaCaptionsFontName(cue.style),
        fontSize: assCue?.fontSize ?? readMediaCaptionsFontSize(cue.style),
        primaryColor: assCue?.primaryColor ?? cue.style?.["--cue-color"],
        bold: assCue?.bold ?? (cue.style?.["font-weight"] === "bold" || undefined),
        italic: assCue?.italic ?? (cue.style?.["font-style"] === "italic" || undefined),
        metadata: providerMetadata
    };
}

function cleanMediaCaptionsText(text: string): string {
    return text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\{\\.*?}/g, "")
        .trim();
}

function readMediaCaptionsFontName(style?: Readonly<Record<string, string>>): string | undefined {
    return style?.["font-family"] || undefined;
}

function readMediaCaptionsFontSize(style?: Readonly<Record<string, string>>): number | undefined {
    const match = style?.["font-size"]?.match(/calc\(\s*([\d.]+)\s*\//i);
    if (!match) return undefined;
    const size = Number(match[1]);
    return Number.isFinite(size) ? size : undefined;
}
