async function parseSubtitleSource(input: SubtitleParseInput): Promise<SubtitleParseResult> {
    const format = detectSubtitleFormat({
        format: input.format,
        filename: input.filename,
        source: input.source
    });

    try {
        const provider = subtitleParserRegistry.resolve(format);
        const result = await provider.parse({ ...input, format });
        const normalized = normalizeSubtitleCues(result.cues, result.format);
        return {
            cues: normalized.cues,
            format: result.format,
            warnings: [...result.warnings, ...normalized.warnings]
        };
    } catch (cause) {
        if (cause instanceof SubtitleParseError) throw cause;
        throw new SubtitleParseError("provider-failed", "Could not parse subtitle source", {
            format,
            cause
        });
    }
}
