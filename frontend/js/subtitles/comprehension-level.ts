export type SubtitleComprehensionLevel = "i+0" | "i+1" | "i+2" | "i+3" | "i+4" | "i+5+";

export const SUBTITLE_COMPREHENSION_LEVELS: readonly SubtitleComprehensionLevel[] = [
    "i+0", "i+1", "i+2", "i+3", "i+4", "i+5+"
];

export const DEFAULT_SUBTITLE_COMPREHENSION_MINIMUM: SubtitleComprehensionLevel = "i+1";

export interface SubtitleComprehensionHighlighter {
    getUnknownKanjiTokenCount?: (text: string) => number;
}

export const KANJI_CONTAINING_TOKEN_RE = /[\u3400-\u9FFF々〆ヵヶ]/;

export function isKanjiContainingToken(token: unknown): boolean {
    return KANJI_CONTAINING_TOKEN_RE.test(String(token || ""));
}

export function getSubtitleComprehensionLevelFromUnknownCount(count: number): SubtitleComprehensionLevel {
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));

    if (normalizedCount >= 5) return "i+5+";

    return `i+${normalizedCount}` as SubtitleComprehensionLevel;
}

export function getSubtitleComprehensionLevel(
    text: string,
    highlighter?: SubtitleComprehensionHighlighter | null
): SubtitleComprehensionLevel {
    const unknownCount = highlighter?.getUnknownKanjiTokenCount?.(text) ?? 0;

    return getSubtitleComprehensionLevelFromUnknownCount(unknownCount);
}

export function normalizeSubtitleComprehensionMinimum(
    value: unknown,
    fallback: SubtitleComprehensionLevel = DEFAULT_SUBTITLE_COMPREHENSION_MINIMUM
): SubtitleComprehensionLevel {
    return SUBTITLE_COMPREHENSION_LEVELS.includes(value as SubtitleComprehensionLevel)
        ? value as SubtitleComprehensionLevel
        : fallback;
}

export function getSubtitleComprehensionMinimum(): SubtitleComprehensionLevel {
    const input = document.getElementById("subtitleComprehensionMinimum") as HTMLInputElement | null;
    return normalizeSubtitleComprehensionMinimum(input?.value);
}

export function shouldShowSubtitleForComprehensionLevel(level: SubtitleComprehensionLevel): boolean {
    const thresholdIndex = SUBTITLE_COMPREHENSION_LEVELS.indexOf(getSubtitleComprehensionMinimum());
    return SUBTITLE_COMPREHENSION_LEVELS.indexOf(level) >= thresholdIndex;
}
