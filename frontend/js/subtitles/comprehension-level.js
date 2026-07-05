const KANJI_CONTAINING_TOKEN_RE = /[\u3400-\u9FFF々〆ヵヶ]/;
function isKanjiContainingToken(token) {
    return KANJI_CONTAINING_TOKEN_RE.test(String(token || ""));
}
function getSubtitleComprehensionLevelFromUnknownCount(count) {
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
    if (normalizedCount >= 5)
        return "i+5+";
    return `i+${normalizedCount}`;
}
function getSubtitleComprehensionLevel(text, highlighter) {
    const unknownCount = highlighter?.getUnknownKanjiTokenCount?.(text) ?? 0;
    return getSubtitleComprehensionLevelFromUnknownCount(unknownCount);
}
function getSubtitleComprehensionVisibilitySettings() {
    return {
        "i+0": document.getElementById("showComprehensionI0")?.checked !== false,
        "i+1": document.getElementById("showComprehensionI1")?.checked !== false,
        "i+2": document.getElementById("showComprehensionI2")?.checked !== false,
        "i+3": document.getElementById("showComprehensionI3")?.checked !== false,
        "i+4": document.getElementById("showComprehensionI4")?.checked !== false,
        "i+5+": document.getElementById("showComprehensionI5Plus")?.checked !== false
    };
}
function shouldShowSubtitleForComprehensionLevel(level) {
    return getSubtitleComprehensionVisibilitySettings()[level] !== false;
}
