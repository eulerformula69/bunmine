interface SubtitleCueDraft extends Omit<SubtitleCue, "id" | "startTime" | "endTime" | "text"> {
    id?: string;
    startTime: number;
    endTime: number;
    text: string;
}

interface SubtitleCueNormalizationResult {
    cues: SubtitleCue[];
    warnings: SubtitleParseWarning[];
}

function normalizeSubtitleCues(
    drafts: readonly SubtitleCueDraft[],
    format: SubtitleFormat = "unknown"
): SubtitleCueNormalizationResult {
    const cues: SubtitleCue[] = [];
    const warnings: SubtitleParseWarning[] = [];

    drafts.forEach((draft, cueIndex) => {
        const startTime = Number(draft.startTime);
        const endTime = Number(draft.endTime);
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
            warnings.push({ code: "invalid-time", message: "Cue has a non-finite time", cueIndex });
            return;
        }

        const safeStartTime = Math.max(0, startTime);
        const safeEndTime = Math.max(safeStartTime, endTime);
        const text = String(draft.text).replace(/\r\n?/g, "\n");
        cues.push({
            ...draft,
            id: draft.id?.trim() || createSubtitleCueId(format, cueIndex, safeStartTime, safeEndTime, text),
            startTime: safeStartTime,
            endTime: safeEndTime,
            text,
            format: draft.format || format
        });
    });

    return { cues, warnings };
}

function createSubtitleCueId(
    format: SubtitleFormat,
    cueIndex: number,
    startTime: number,
    endTime: number,
    text: string
): string {
    const value = `${format}\u0000${cueIndex}\u0000${startTime}\u0000${endTime}\u0000${text}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `cue-${(hash >>> 0).toString(36)}`;
}
