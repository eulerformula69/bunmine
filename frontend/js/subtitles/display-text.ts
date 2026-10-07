const SUBTITLE_ANNOTATION_PATTERNS = [
    /\([^()]*\)/gu,
    /（[^（）]*）/gu,
    /\[[^\[\]]*\]/gu,
    /［[^［］]*］/gu,
    /【[^【】]*】/gu,
    /〔[^〔〕]*〕/gu
];

export function areSubtitleAnnotationsVisible(): boolean {
    if (typeof document === "undefined") return true;

    const input = document.getElementById("subtitleAnnotationsVisible") as HTMLInputElement | null;
    return input?.checked !== false;
}

export function removeSubtitleAnnotations(text: string): string {
    let result = String(text || "");
    let previous = "";

    while (result !== previous) {
        previous = result;
        for (const pattern of SUBTITLE_ANNOTATION_PATTERNS) {
            result = result.replace(pattern, "");
        }
    }

    return result
        .replace(/[ \t]+/gu, " ")
        .replace(/[ \t]*\n[ \t]*/gu, "\n")
        .replace(/\n{2,}/gu, "\n")
        .trim();
}

export function getSubtitleDisplayText(
    text: string,
    annotationsVisible = areSubtitleAnnotationsVisible()
): string {
    return annotationsVisible ? String(text || "") : removeSubtitleAnnotations(text);
}
