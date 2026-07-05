type SubtitleComprehensionLevel = "i+0" | "i+1" | "i+2" | "i+3" | "i+4" | "i+5+";

interface SubtitleComprehensionVisibilitySettings {
    "i+0": boolean;
    "i+1": boolean;
    "i+2": boolean;
    "i+3": boolean;
    "i+4": boolean;
    "i+5+": boolean;
}

interface SubtitleComprehensionHighlighter {
    getUnknownKanjiTokenCount?: (text: string) => number;
}

const KANJI_CONTAINING_TOKEN_RE = /[\u3400-\u9FFF々〆ヵヶ]/;

function isKanjiContainingToken(token: unknown): boolean {
    return KANJI_CONTAINING_TOKEN_RE.test(String(token || ""));
}

function getSubtitleComprehensionLevelFromUnknownCount(count: number): SubtitleComprehensionLevel {
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));

    if (normalizedCount >= 5) return "i+5+";

    return `i+${normalizedCount}` as SubtitleComprehensionLevel;
}

function getSubtitleComprehensionLevel(
    text: string,
    highlighter?: SubtitleComprehensionHighlighter | null
): SubtitleComprehensionLevel {
    const unknownCount = highlighter?.getUnknownKanjiTokenCount?.(text) ?? 0;

    return getSubtitleComprehensionLevelFromUnknownCount(unknownCount);
}

function getSubtitleComprehensionVisibilitySettings(): SubtitleComprehensionVisibilitySettings {
    return {
        "i+0": (document.getElementById("showComprehensionI0") as HTMLInputElement | null)?.checked !== false,
        "i+1": (document.getElementById("showComprehensionI1") as HTMLInputElement | null)?.checked !== false,
        "i+2": (document.getElementById("showComprehensionI2") as HTMLInputElement | null)?.checked !== false,
        "i+3": (document.getElementById("showComprehensionI3") as HTMLInputElement | null)?.checked !== false,
        "i+4": (document.getElementById("showComprehensionI4") as HTMLInputElement | null)?.checked !== false,
        "i+5+": (document.getElementById("showComprehensionI5Plus") as HTMLInputElement | null)?.checked !== false
    };
}

function shouldShowSubtitleForComprehensionLevel(level: SubtitleComprehensionLevel): boolean {
    return getSubtitleComprehensionVisibilitySettings()[level] !== false;
}
