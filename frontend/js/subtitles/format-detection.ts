interface SubtitleFormatDetectionInput {
    format?: SubtitleFormat;
    filename?: string;
    mimeType?: string;
    source?: string;
}

function detectSubtitleFormat(input: SubtitleFormatDetectionInput): SubtitleFormat {
    if (input.format && input.format !== "unknown") return input.format;

    const extension = input.filename?.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (extension === "srt" || extension === "vtt" || extension === "ass" || extension === "ssa") {
        return extension;
    }

    const mimeType = input.mimeType?.split(";", 1)[0].trim().toLowerCase();
    const mimeFormats: Record<string, SubtitleFormat> = {
        "application/x-subrip": "srt",
        "application/x-srt": "srt",
        "text/srt": "srt",
        "text/vtt": "vtt",
        "text/x-ass": "ass",
        "text/x-ssa": "ssa",
        "application/x-ass": "ass",
        "application/x-ssa": "ssa"
    };
    if (mimeType && mimeFormats[mimeType]) return mimeFormats[mimeType];

    const source = input.source?.replace(/^\uFEFF/, "").trimStart() || "";
    if (/^WEBVTT(?:\s|$)/i.test(source)) return "vtt";
    if (/^\[(?:Script Info|V4\+? Styles|Events)]/im.test(source) && /^Dialogue:/im.test(source)) {
        return "ass";
    }
    if (/^(?:\d+\s*\r?\n)?\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s+-->\s+/m.test(source)) {
        return "srt";
    }

    return "unknown";
}
