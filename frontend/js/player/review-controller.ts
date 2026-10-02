import { candidateApi } from "./candidate-api.js";

import { AnkiMediaSnapshot } from "../anki/media-snapshot.js";

import { MiningCandidate,findCandidateNote } from "./candidate-model.js";

import { t } from "../core/translate.js";

export interface CandidateReviewOptions {
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

export function createCandidateReviewController(options: CandidateReviewOptions) {
    let busy = false;
    async function completeCandidate(
        candidate: MiningCandidate,
        findNote: (snapshot: AnkiMediaSnapshot, renew: () => Promise<void>) => Promise<number>
    ): Promise<void> {
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
            const claim = await options.action(candidate.id, "claim", undefined, undefined, candidate.revision);
            token = claim.token;
            if (claim.ankiNoteId) candidate.anki_note_id = claim.ankiNoteId;
            renewTimer = setInterval(() => {
                void renew().catch((error) => { leaseError = error; });
            }, 20000);
            let noteId = candidate.anki_note_id;
            if (!noteId) {
                noteId = await findNote(candidate.snapshot, renew);
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
    }
    return {
        isBusy: () => busy,
        async acquireCandidate(candidate: MiningCandidate): Promise<void> {
            await completeCandidate(candidate, async (snapshot, renew) => {
                const previous = await options.noteIds(snapshot);
                await options.copy(snapshot.selectedWord || "");
                options.status(t("candidateWaiting"));
                const deadline = options.now() + 60000;
                let noteId: number | null = null;
                while (options.now() < deadline) {
                    await renew();
                    noteId = findCandidateNote(previous, await options.noteIds(snapshot));
                    if (noteId) break;
                    await options.sleep(1000);
                }
                if (!noteId) throw new Error(t("candidateTimeout"));
                return noteId;
            });
        },
        async attachLatestCandidate(candidate: MiningCandidate): Promise<void> {
            await completeCandidate(candidate, async (snapshot) => {
                const noteIds = await options.noteIds(snapshot);
                const noteId = noteIds[noteIds.length - 1];
                if (!noteId) throw new Error(t("candidateNoNotes"));
                return noteId;
            });
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
