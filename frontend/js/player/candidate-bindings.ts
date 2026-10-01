import { AnkiMediaSnapshot, fetchNoteIdsByQuery, fetchNotesInfo, stripHtml } from "./anki-actions.js";
import { getCleanSelectedText, showToast, t } from "./ui.js";
import { getSubtitleIndexFromSelection } from "./selection-model.js";
import { createCandidateExportService } from "./candidate-export.js";
import { candidateApi } from "./candidate-api.js";
import { createCandidateReviewController } from "./review-controller.js";
import { ankiMediaController, refreshTargetNoteList, updateAnkiNoteWithSnapshot } from "./app.js";
import { sleep } from "../core/api.js";
import { createCandidateLoop } from "./candidate-loop.js";
import { sidebar, video } from "../core/dom.js";
import { createCandidatePanel } from "./candidate-panel.js";
import { ankiAcquireRunningState, runExclusiveAnkiAcquire } from "./anki-acquire-lock.js";
import { getCurrentVideoPayload } from "../video/media-payload.js";
import { resetLibraryProgressTracking } from "../video/progress.js";
import { playCandidateSource } from "./candidate-playback.js";
import { captureCandidateContext, restoreCandidateContext } from "./candidate-context-model.js";
import { state } from "../core/state.js";
import { createCandidateCaptureController } from "./capture-controller.js";
import { getSubtitleContextRange } from "../subtitles/subtitles-sidebar.js";
import { autoAttachController } from "./auto-attach-bindings.js";
export async function verifyCandidateAnkiNote(noteId: number, snapshot: AnkiMediaSnapshot): Promise<void> {
    const [note] = await fetchNotesInfo(snapshot.ankiUrl, [noteId]);
    const word = stripHtml(snapshot.selectedWord).toLowerCase();
    if (!note || !Object.values(note.fields || {}).some((field) =>
        stripHtml(field.value).toLowerCase().includes(word))) {
        throw new Error(t("candidateMismatch"));
    }
}

export const candidateExports = createCandidateExportService({
    source: candidateApi.source,
    configure: (snapshot) => {
        for (const key of ["ankiUrl", "deckName", "pictureField", "audioField"] as const) {
            if (!snapshot[key]) snapshot[key] = (document.getElementById(key) as HTMLInputElement).value.trim();
            if (!snapshot[key]) throw new Error(t("candidateSettings"));
        }
    },
});

export const candidateReview = createCandidateReviewController({
    action: candidateApi.action,
    noteIds: (snapshot) => fetchNoteIdsByQuery(snapshot.ankiUrl, "", "AnkiConnect candidate baseline"),
    copy: (word) => navigator.clipboard.writeText(word),
    verify: verifyCandidateAnkiNote,
    update: async (noteId, snapshot) => {
        await updateAnkiNoteWithSnapshot(noteId, snapshot);
        void refreshTargetNoteList({ preserveSelection: false });
    },
    sleep,
    changed: () => candidatePanel.refresh(),
    status: (message) => candidatePanel.status(message),
    now: () => Date.now(),
});

export const candidateLoop = createCandidateLoop(video);
export const candidatePanel = createCandidatePanel({
    sidebar,
    busy: () => candidateReview.isBusy() || ankiAcquireRunningState.value,
    playback: (candidate, restart) => {
        if (candidate && JSON.stringify(candidate.snapshot.videoPayload) !== JSON.stringify(getCurrentVideoPayload())) candidate = undefined;
        candidateLoop.set(candidate?.snapshot || null, restart);
        if (candidate && restart) resetLibraryProgressTracking();
    },
    select: async (candidate) => {
        Object.assign(candidate, await playCandidateSource(candidate));
        return restoreCandidateContext(candidate.snapshot, state.subtitles);
    },
    saveContext: (candidate, context, start, end) => candidateExports.trackSave(candidate.id,
        runExclusiveAnkiAcquire(() => candidateApi.context(candidate, context, start, end))),
    acquire: async (candidate) => {
        const saved = await candidateExports.load(candidate.id);
        await runExclusiveAnkiAcquire(() => candidateReview.acquireCandidate(saved));
    },
    reject: candidateReview.reject,
    error: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        candidatePanel.status(message);
        showToast(message, "error", 6000);
    },
});

export const captureCandidate = createCandidateCaptureController({
    buildSnapshot: (index) => {
        const snapshot = ankiMediaController.buildSnapshot({ subtitleIndex: index, validateAnki: false });
        const range = getSubtitleContextRange(index);
        snapshot.context = captureCandidateContext(snapshot, state.subtitles, range.startIdx, range.endIdx);
        return snapshot;
    },
    save: candidateApi.capture,
    saved: async () => {
        showToast(t("candidateSaved"), "success");
        await candidatePanel.refresh();
    },
});

export async function captureSelectedCandidate(): Promise<void> {
    try {
        autoAttachController.cancel();
        await captureCandidate(getCleanSelectedText(), getSubtitleIndexFromSelection());
    } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "error", 6000);
    }
}

void candidatePanel.refresh().catch((error) => candidatePanel.status(String(error)));
window.addEventListener("focus", () => {
    if (!candidateReview.isBusy()) void candidatePanel.refresh().catch((error) => candidatePanel.status(String(error)));
});
