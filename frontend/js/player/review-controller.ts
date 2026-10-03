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
    removeAfterSuccess(): boolean;
}

class CandidateAcquireCancelled extends Error {}

export function createCandidateReviewController(options: CandidateReviewOptions) {
    let busy = false;
    let acquireController: AbortController | null = null;
    let activeCandidateId: number | null = null;
    let activeCompletion: Promise<boolean> = Promise.resolve(false);

    function throwIfAcquireCancelled(signal: AbortSignal): void {
        if (signal.aborted) throw new CandidateAcquireCancelled();
    }

    function waitForNextPoll(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const cleanup = () => signal.removeEventListener("abort", cancel);
            const cancel = () => {
                cleanup();
                reject(new CandidateAcquireCancelled());
            };
            signal.addEventListener("abort", cancel, { once: true });
            if (signal.aborted) {
                cancel();
                return;
            }
            options.sleep(ms).then(() => {
                cleanup();
                resolve();
            }, (error) => {
                cleanup();
                reject(error);
            });
        });
    }

    async function completeCandidate(
        candidate: MiningCandidate,
        findNote: (snapshot: AnkiMediaSnapshot, renew: () => Promise<void>) => Promise<number>
    ): Promise<boolean> {
        if (busy) return false;
        busy = true;
        activeCandidateId = candidate.id;
        let token: string | undefined;
        let renewTimer: ReturnType<typeof setInterval> | undefined;
        let leaseError: Error | null = null;
        let removed = false;
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
            if (options.removeAfterSuccess()) {
                await renew();
                await options.action(candidate.id, "accept", token);
                token = undefined;
                removed = true;
            }
            options.status(t("candidateDone"));
            return removed;
        } finally {
            clearInterval(renewTimer);
            if (token) await options.action(candidate.id, "release", token).catch(() => {});
            busy = false;
            activeCandidateId = null;
            await options.changed();
        }
    }
    return {
        isBusy: () => busy,
        async acquireCandidate(candidate: MiningCandidate): Promise<void> {
            if (busy) return;
            const controller = new AbortController();
            acquireController = controller;
            const operation = completeCandidate(candidate, async (snapshot, renew) => {
                const previous = await options.noteIds(snapshot);
                throwIfAcquireCancelled(controller.signal);
                await options.copy(snapshot.selectedWord || "");
                options.status(t("candidateWaiting"));
                const deadline = options.now() + 60000;
                let noteId: number | null = null;
                while (options.now() < deadline) {
                    throwIfAcquireCancelled(controller.signal);
                    await renew();
                    throwIfAcquireCancelled(controller.signal);
                    noteId = findCandidateNote(previous, await options.noteIds(snapshot));
                    throwIfAcquireCancelled(controller.signal);
                    if (noteId) break;
                    await waitForNextPoll(1000, controller.signal);
                }
                if (!noteId) throw new Error(t("candidateTimeout"));
                return noteId;
            });
            activeCompletion = operation.catch(() => false);
            try {
                await operation;
            } catch (error) {
                if (!(error instanceof CandidateAcquireCancelled)) throw error;
            } finally {
                if (acquireController === controller) acquireController = null;
            }
        },
        cancelAcquire(): void {
            acquireController?.abort();
        },
        async attachLatestCandidate(candidate: MiningCandidate): Promise<void> {
            if (busy) return;
            const operation = completeCandidate(candidate, async (snapshot) => {
                const noteIds = await options.noteIds(snapshot);
                const noteId = noteIds[noteIds.length - 1];
                if (!noteId) throw new Error(t("candidateNoNotes"));
                return noteId;
            });
            activeCompletion = operation.catch(() => false);
            await operation;
        },
        async reject(candidate: MiningCandidate): Promise<void> {
            if (activeCandidateId === candidate.id) {
                acquireController?.abort();
                if (await activeCompletion) return;
            }
            try {
                await options.action(candidate.id, "reject");
                options.status(t("candidateSkipped"));
            } finally {
                await options.changed();
            }
        },
    };
}
