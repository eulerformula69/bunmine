class SubtitleParserRegistry {
    private readonly providers: SubtitleParser[] = [];

    register(provider: SubtitleParser): void {
        this.unregister(provider.id);
        this.providers.unshift(provider);
    }

    unregister(providerId: string): void {
        const index = this.providers.findIndex((provider) => provider.id === providerId);
        if (index >= 0) this.providers.splice(index, 1);
    }

    resolve(format: SubtitleFormat): SubtitleParser {
        return this.resolveAll(format)[0];
    }

    resolveAll(format: SubtitleFormat): SubtitleParser[] {
        if (format === "unknown") {
            throw new SubtitleParseError("unsupported-format", "Could not determine subtitle format", { format });
        }
        const providers = this.providers.filter((candidate) => candidate.supports(format));
        if (!providers.length) {
            throw new SubtitleParseError("unsupported-format", `Unsupported subtitle format: ${format}`, { format });
        }
        return providers;
    }
}

const subtitleParserRegistry = new SubtitleParserRegistry();
subtitleParserRegistry.register(new LegacySubtitleParser());
subtitleParserRegistry.register(new MediaCaptionsSubtitleParser());
