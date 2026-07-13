function fromRuntimeSubtitleCue(
    cue: RuntimeSubtitleCue,
    format: SubtitleFormat
): SubtitleCueDraft {
    return {
        startTime: cue.start,
        endTime: cue.end,
        text: cue.text,
        format,
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

class LegacySubtitleParser implements SubtitleParser {
    readonly id = "legacy";

    supports(format: SubtitleFormat): boolean {
        return format === "srt" || format === "vtt" || format === "ass" || format === "ssa";
    }

    async parse(input: SubtitleParseInput): Promise<SubtitleParseResult> {
        if (!this.supports(input.format)) {
            throw new SubtitleParseError("unsupported-format", `Unsupported subtitle format: ${input.format}`, {
                format: input.format
            });
        }

        try {
            const runtimeCues = input.format === "ass" || input.format === "ssa"
                ? parseASS(input.source)
                : parseSRT(input.source);
            const normalized = normalizeSubtitleCues(
                runtimeCues.map((cue) => fromRuntimeSubtitleCue(cue, input.format)),
                input.format
            );
            return { ...normalized, format: input.format };
        } catch (cause) {
            throw new SubtitleParseError("legacy-parser-failed", "Could not parse subtitle source", {
                format: input.format,
                cause
            });
        }
    }
}
