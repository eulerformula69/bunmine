interface CandidateReviewOptions {
    action: typeof candidateApi.action;
    noteIds(snapshot: AnkiMediaSnapshot): Promise<number[]>;
    copy(word: string): Promise<void>;
    verify(noteId: number, snapshot: AnkiMediaSnapshot): Promise<void>;
    update(noteId: number, snapshot: AnkiMediaSnapshot): Promise<unknown>;
    sleep(ms: number): Promise<void>;
    changed(): Promise<void>;
    status(message: string): void;
    now(): number;
}

function createCandidateReviewController(options: CandidateReviewOptions) {
    let busy = false;
    return {
        isBusy: () => busy,
        async acquireCandidate(candidate: MiningCandidate): Promise<void> {
            if (busy) return;
            busy = true;
            let token: string | undefined;
            let renewTimer: ReturnType<typeof setInterval> | undefined;
            let leaseError: Error | null = null;
            const renew = async () => {
                if (leaseError) throw leaseError;
                await options.action(candidate.id, "renew", token);
            };
            try {
                const claim = await options.action(candidate.id, "claim");
                token = claim.token;
                if (claim.ankiNoteId) candidate.anki_note_id = claim.ankiNoteId;
                renewTimer = setInterval(() => {
                    void renew().catch((error) => { leaseError = error; });
                }, 20000);
                let noteId = candidate.anki_note_id;
                if (!noteId) {
                    const previous = await options.noteIds(candidate.snapshot);
                    await options.copy(candidate.snapshot.selectedWord || "");
                    options.status(t("candidateWaiting"));
                    const deadline = options.now() + 60000;
                    while (options.now() < deadline) {
                        await renew();
                        noteId = findCandidateNote(previous, await options.noteIds(candidate.snapshot));
                        if (noteId) break;
                        await options.sleep(1000);
                    }
                    if (!noteId) throw new Error(t("candidateTimeout"));
                    await options.verify(noteId, candidate.snapshot);
                    await options.action(candidate.id, "bind", token, noteId);
                    candidate.anki_note_id = noteId;
                }
                await renew();
                await options.verify(noteId, candidate.snapshot);
                options.status(t("candidateAttaching"));
                await options.update(noteId, candidate.snapshot);
                await renew();
                await options.action(candidate.id, "accept", token);
                token = undefined;
                options.status(t("candidateDone"));
            } finally {
                clearInterval(renewTimer);
                if (token) await options.action(candidate.id, "release", token).catch(() => {});
                busy = false;
                await options.changed();
            }
        },
        async reject(candidate: MiningCandidate): Promise<void> {
            if (busy) return;
            busy = true;
            try {
                await options.action(candidate.id, "reject");
                options.status(t("candidateSkipped"));
            } finally {
                busy = false;
                await options.changed();
            }
        },
    };
}
