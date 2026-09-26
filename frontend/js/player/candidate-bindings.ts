const candidateReview = createCandidateReviewController({
    action: candidateApi.action,
    noteIds: (snapshot) => fetchNoteIdsByQuery(snapshot.ankiUrl, "", "AnkiConnect candidate baseline"),
    copy: (word) => navigator.clipboard.writeText(word),
    verify: async (noteId, snapshot) => {
        const [note] = await fetchNotesInfo(snapshot.ankiUrl, [noteId]);
        const word = stripHtml(snapshot.selectedWord).toLowerCase();
        if (!note || !Object.values(note.fields || {}).some((field) =>
            stripHtml(field.value).toLowerCase().includes(word))) {
            throw new Error("Слово не найдено в новой карточке. Проверьте её в Anki перед повторной попыткой.");
        }
    },
    update: async (noteId, snapshot) => {
        await updateAnkiNoteWithSnapshot(noteId, snapshot);
        void refreshTargetNoteList({ preserveSelection: false });
    },
    sleep,
    changed: () => candidatePanel.refresh(),
    status: (message) => candidatePanel.status(message),
    now: () => Date.now(),
});

const candidatePanel = createCandidatePanel({
    sidebar,
    busy: candidateReview.isBusy,
    select: playCandidateSource,
    acquire: async (candidate) => {
        // Keep capture settings. Supply missing Anki configuration at review time.
        for (const key of ["ankiUrl", "deckName", "pictureField", "audioField"] as const) {
            if (!candidate.snapshot[key]) {
                candidate.snapshot[key] = (document.getElementById(key) as HTMLInputElement).value.trim();
            }
            if (!candidate.snapshot[key]) throw new Error("Заполните настройки Anki перед добавлением карточки.");
        }
        await candidateReview.acquireCandidate(candidate);
    },
    reject: candidateReview.reject,
    error: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        candidatePanel.status(message);
        showToast(message, "error", 6000);
    },
});

const captureCandidate = createCandidateCaptureController({
    buildSnapshot: (index) => ankiMediaController.buildSnapshot({ subtitleIndex: index, validateAnki: false }),
    save: candidateApi.capture,
    saved: async () => {
        showToast("Кандидат сохранён. Разберите его в правой панели.", "success");
        await candidatePanel.refresh();
    },
});

async function captureSelectedCandidate(): Promise<void> {
    try {
        await captureCandidate(getCleanSelectedText(), getSubtitleIndexFromSelection());
    } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "error", 6000);
    }
}

void candidatePanel.refresh().catch((error) => candidatePanel.status(String(error)));
window.addEventListener("focus", () => {
    if (!candidateReview.isBusy()) void candidatePanel.refresh().catch((error) => candidatePanel.status(String(error)));
});
