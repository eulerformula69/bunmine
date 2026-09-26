interface MiningCandidate {
    revision?: number;
    id: number;
    snapshot: AnkiMediaSnapshot;
    episode_id: number | null;
    source_identity: string;
    status: "pending" | "accepted" | "rejected";
    anki_note_id: number | null;
}

function findCandidateNote(previous: number[], current: number[]): number | null {
    const baseline = new Set(previous);
    const added = [...new Set(current)].filter((id) => !baseline.has(id));
    if (added.length > 1) throw new Error(t("candidateMultiple"));
    return added[0] || null;
}

function candidateCaptureHotkey(event: KeyboardEvent): boolean {
    return event.code === "KeyQ" && event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat;
}
