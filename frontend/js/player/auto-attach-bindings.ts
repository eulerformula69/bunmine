let autoAttachToast: HTMLElement | null = null;
const autoAttachController = createAutoAttachController({
    enabled: () => (document.getElementById("autoAttachNextCardEnabled") as HTMLInputElement)?.checked === true,
    snapshot: resolveAnkiExportSnapshot,
    noteIds: (snapshot) => fetchNoteIdsByQuery(snapshot.ankiUrl, "", "AnkiConnect automatic attachment"),
    verify: verifyCandidateAnkiNote,
    update: async (noteId, snapshot) => {
        await updateAnkiNoteWithSnapshot(noteId, snapshot);
        void refreshTargetNoteList({ preserveSelection: false });
    },
    exclusive: runExclusiveAnkiAcquire,
    sleep,
    now: () => Date.now(),
    status: (key, word) => {
        candidatePanel.render();
        autoAttachToast?.remove();
        if (key === "toastAutoAttachDone") {
            showToast(t(key), "success");
            autoAttachToast = null;
        } else {
            autoAttachToast = showActionToast(t(key, { word }), [
                { label: t("toastAutoAttachCancel"), onClick: () => autoAttachController.cancel() },
            ]);
        }
    },
    done: () => {
        autoAttachToast?.remove();
        autoAttachToast = null;
        candidatePanel.render();
    },
    error: (error) => showToast(t("toastAutoAttachFailed", {
        message: error instanceof Error ? error.message : String(error),
    }), "error", 6000),
});

document.getElementById("autoAttachNextCardEnabled")?.addEventListener("change", (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    if (!enabled) autoAttachController.cancel();
    showToast(t(enabled ? "toastAutoAttachEnabled" : "toastAutoAttachDisabled"));
});
