interface CandidateCue { start: number; end: number; text: string; }
interface CandidateContext {
    cues: CandidateCue[];
    anchor: number;
    start: number;
    end: number;
    startOffset: number;
    endOffset: number;
}

function captureCandidateContext(snapshot: AnkiMediaSnapshot, cues: CandidateCue[], start: number, end: number): CandidateContext {
    return {
        cues: cues.map(({ start, end, text }) => ({ start, end, text })),
        anchor: snapshot.currentIdx, start, end,
        startOffset: snapshot.audioStart - cues[start].start,
        endOffset: snapshot.audioEnd - cues[end].end,
    };
}

function restoreCandidateContext(snapshot: AnkiMediaSnapshot, cues: CandidateCue[]): CandidateContext | null {
    if (snapshot.context) return snapshot.context;
    const anchor = snapshot.currentIdx;
    if (!cues[anchor]) return null;
    // Old candidates retain their original snapshot until the user edits a boundary.
    for (let start = anchor; start >= 0; start--) {
        let text = "";
        for (let end = start; end < cues.length; end++) {
            text += (end > start ? " " : "") + cues[end].text;
            if (text.length > snapshot.combinedText.length) break;
            if (end >= anchor && text === snapshot.combinedText) {
                return captureCandidateContext(snapshot, cues, start, end);
            }
        }
        if (cues.slice(start, anchor + 1).map((cue) => cue.text).join(" ").length > snapshot.combinedText.length) break;
    }
    return null;
}

function candidateContextSnapshot(snapshot: AnkiMediaSnapshot, context: CandidateContext, start: number, end: number): AnkiMediaSnapshot {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > context.anchor || end < context.anchor || end >= context.cues.length) {
        throw new Error("Invalid candidate context range");
    }
    const selection = buildSubtitleContextSelection(context.cues, context.anchor, context.anchor - start, end - context.anchor)!;
    const combinedText = selection.text;
    const audioStart = Math.max(0, selection.startTime + context.startOffset);
    const endTime = selection.endTime + context.endOffset;
    const audioEnd = endTime > audioStart ? endTime : audioStart + 0.5;
    return { ...snapshot, combinedText, audioStart, audioEnd,
        imageSubtitleText: snapshot.imageSubtitleText ? combinedText : "",
        imageSubtitleCues: snapshot.imageSubtitleText ? context.cues.slice(start, end + 1).map((cue) => ({
            start: cue.start + (snapshot.imageSubtitleDelay || 0),
            end: cue.end + (snapshot.imageSubtitleDelay || 0), text: cue.text
        })) : [],
        context: { ...context, start, end } };
}
