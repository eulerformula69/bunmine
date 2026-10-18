import type { AnkiMediaController } from "./anki-actions.js";
import { fetchNoteIdsByQuery } from "../anki/notes.js";
import { escapeAnkiSearchValue } from "../highlighter/word-index-sync.js";

export function updateManualCardButton(): void {
    const button = document.getElementById("updateLastCardBtn");
    const enabled = document.getElementById("manualCardUpdateEnabled") as HTMLInputElement | null;
    if (button) button.hidden = enabled?.checked !== true;
}

export function bindManualCardUpdate(
    controller: AnkiMediaController,
    translate: (key: "manualCardDeckEmpty" | "manualCardUpdated" | "manualCardUpdating") => string,
    toast: (message: string, type: string, timeout?: number) => HTMLElement | void,
    findNotes = fetchNoteIdsByQuery
): void {
    const button = document.getElementById("updateLastCardBtn") as HTMLButtonElement | null;
    document.getElementById("manualCardUpdateEnabled")?.addEventListener("change", updateManualCardButton);
    button?.addEventListener("click", async () => {
        if (button.disabled || button.hidden) return;
        button.disabled = true;
        const pending = toast(translate("manualCardUpdating"), "info", 0);
        try {
            const snapshot = controller.buildSnapshot();
            const ids = await findNotes(snapshot.ankiUrl, `deck:"${escapeAnkiSearchValue(snapshot.deckName)}"`);
            const latest = ids.reduce((last, id) => Math.max(last, id), 0);
            if (!latest) throw new Error(translate("manualCardDeckEmpty"));
            await controller.updateNote(latest, snapshot);
            pending?.remove();
            toast(translate("manualCardUpdated"), "success", 5000);
        } catch (error) {
            toast(error instanceof Error ? error.message : String(error), "error");
        } finally {
            pending?.remove();
            button.disabled = false;
        }
    });
}
