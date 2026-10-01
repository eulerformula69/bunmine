export function stripHtml(input: unknown): string {
    return String(input || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function escapeRegExp(text: string): string {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function boldWordInText(text: string, word: string): string {
    const source = String(text || "");
    const target = stripHtml(word);

    if (!target) return source;

    const pattern = new RegExp(`${escapeRegExp(target)}(\\[[^\\]]+\\])?`, "g");

    return source.replace(pattern, (match) => `<b>${match}</b>`);
}

export function getNoteWord(noteInfo: { fields?: Record<string, { value?: unknown }> } | null | undefined): string {
    const fields = noteInfo?.fields || {};
    const wordFieldNames = (
        (document.getElementById("highlightWordField") as HTMLInputElement | null)?.value || "Word"
    )
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

    for (const fieldName of wordFieldNames) {
        const word = stripHtml(fields[fieldName]?.value);
        if (word) return word;
    }

    return "";
}

export function pickNotePreviewText(noteInfo: { fields?: Record<string, { value?: unknown }> } | null | undefined): string {
    const fields = noteInfo?.fields || {};
    const preferredFieldOrder = [
        "Word", "Key", "Expression", "Sentence", "Front", "Back", "Meaning", "Definition"
    ];

    for (const key of preferredFieldOrder) {
        const value = stripHtml(fields[key]?.value);
        if (value) return value;
    }

    for (const field of Object.values(fields)) {
        const value = stripHtml(field?.value);
        if (value) return value;
    }

    return "";
}
