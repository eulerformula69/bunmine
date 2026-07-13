async function parseSubtitleSource(input: SubtitleParseInput): Promise<SubtitleParseResult> {
    const format = detectSubtitleFormat({
        format: input.format,
        filename: input.filename,
        source: input.source
    });

    const providers = subtitleParserRegistry.resolveAll(format);
    const fallbackWarnings: SubtitleParseWarning[] = [];

    for (let index = 0; index < providers.length; index += 1) {
        const provider = providers[index];
        try {
            const result = await provider.parse({ ...input, format });
            const normalized = normalizeSubtitleCues(result.cues, result.format);
            return {
                cues: normalized.cues,
                format: result.format,
                warnings: [...fallbackWarnings, ...result.warnings, ...normalized.warnings]
            };
        } catch (cause) {
            const canFallback = cause instanceof SubtitleParseError
                && isSubtitleProviderCompatibilityError(cause)
                && index < providers.length - 1;
            if (canFallback) {
                fallbackWarnings.push({
                    code: "provider-fallback",
                    message: `${provider.id} could not parse ${format}; using ${providers[index + 1].id}`
                });
                continue;
            }
            if (cause instanceof SubtitleParseError) throw cause;
            throw new SubtitleParseError("provider-failed", `Subtitle provider ${provider.id} failed`, {
                format,
                cause
            });
        }
    }

    throw new SubtitleParseError("unsupported-format", `Unsupported subtitle format: ${format}`, { format });
}
