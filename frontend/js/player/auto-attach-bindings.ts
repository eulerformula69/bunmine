import { createAutoAttachController } from "./auto-attach-controller.js";
import { reportError } from "./toast.js";

import { resolveAnkiExportSnapshot } from "./candidate-export.js";

import { fetchNoteIdsByQuery } from "../anki/notes.js";

import { candidatePanel,verifyCandidateAnkiNote } from "./candidate-bindings.js";

import { refreshTargetNoteList,updateAnkiNoteWithSnapshot } from "./controllers.js";

import { runExclusiveAnkiAcquire } from "./anki-acquire-lock.js";

import { sleep } from "../core/api.js";

import { t } from "../core/translate.js";
import { showActionToast,showToast } from "./ui.js";

export const autoAttachToastState = { value: null as HTMLElement | null };

export const autoAttachController = createAutoAttachController({
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
        autoAttachToastState.value?.remove();
        if (key === "toastAutoAttachDone") {
            showToast(t(key), "success");
            autoAttachToastState.value = null;
        } else {
            autoAttachToastState.value = showActionToast(t(key, { word }), [
                { label: t("toastAutoAttachCancel"), onClick: () => autoAttachController.cancel() },
            ]);
        }
    },
    done: () => {
        autoAttachToastState.value?.remove();
        autoAttachToastState.value = null;
        candidatePanel.render();
    },
    error: (error) => reportError(error, {key: "toastAutoAttachFailed"}),
});

document.getElementById("autoAttachNextCardEnabled")?.addEventListener("change", (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    if (!enabled) autoAttachController.cancel();
    showToast(t(enabled ? "toastAutoAttachEnabled" : "toastAutoAttachDisabled"));
});
