async function verifyCandidateAnkiNote(noteId: number, snapshot: AnkiMediaSnapshot): Promise<void> {
    const [note] = await fetchNotesInfo(snapshot.ankiUrl, [noteId]);
    const word = stripHtml(snapshot.selectedWord).toLowerCase();
    if (!note || !Object.values(note.fields || {}).some((field) =>
        stripHtml(field.value).toLowerCase().includes(word))) {
        throw new Error(t("candidateMismatch"));
    }
}

const candidateReview = createCandidateReviewController({
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

const candidateLoop = createCandidateLoop(video);
const candidatePanel = createCandidatePanel({
    sidebar,
    busy: () => candidateReview.isBusy() || ankiAcquireRunning,
    playback: (candidate, restart) => {
        if (candidate && JSON.stringify(candidate.snapshot.videoPayload) !== JSON.stringify(getCurrentVideoPayload())) candidate = undefined;
        candidateLoop.set(candidate?.snapshot || null, restart);
        if (candidate && restart) resetLibraryProgressTracking();
        if (candidate && restart) void video.play().catch((error) => candidatePanel.status(String(error)));
    },
    select: async (candidate) => {
        Object.assign(candidate, await playCandidateSource(candidate));
        return restoreCandidateContext(candidate.snapshot, subtitles);
    },
    saveContext: (candidate, context, start, end) => runExclusiveAnkiAcquire(() => candidateApi.context(candidate, context, start, end)),
    acquire: async (candidate) => {
        // Keep capture settings. Supply missing Anki configuration at review time.
        for (const key of ["ankiUrl", "deckName", "pictureField", "audioField"] as const) {
            if (!candidate.snapshot[key]) {
                candidate.snapshot[key] = (document.getElementById(key) as HTMLInputElement).value.trim();
            }
            if (!candidate.snapshot[key]) throw new Error(t("candidateSettings"));
        }
        await runExclusiveAnkiAcquire(() => candidateReview.acquireCandidate(candidate));
    },
    reject: candidateReview.reject,
    error: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        candidatePanel.status(message);
        showToast(message, "error", 6000);
    },
});

const captureCandidate = createCandidateCaptureController({
    buildSnapshot: (index) => {
        const snapshot = ankiMediaController.buildSnapshot({ subtitleIndex: index, validateAnki: false });
        const range = getSubtitleContextRange(index);
        snapshot.context = captureCandidateContext(snapshot, subtitles, range.startIdx, range.endIdx);
        return snapshot;
    },
    save: candidateApi.capture,
    saved: async () => {
        showToast(t("candidateSaved"), "success");
        await candidatePanel.refresh();
    },
});

async function captureSelectedCandidate(): Promise<void> {
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
