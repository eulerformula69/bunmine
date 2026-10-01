import { AnkiMediaSnapshot } from "./anki-actions.js";
import { MiningCandidate } from "./candidate-model.js";
import { t } from "./ui.js";
export function createCandidateCaptureController(options: {
    buildSnapshot(index: number): AnkiMediaSnapshot;
    save(snapshot: AnkiMediaSnapshot): Promise<MiningCandidate>;
    saved(): Promise<void>;
}) {
    let saving = false;
    return async function captureCandidate(word: string, subtitleIndex: number): Promise<void> {
        if (saving) return;
        if (!word.trim() || subtitleIndex < 0) throw new Error(t("candidateSelectWord"));
        saving = true;
        try {
            const snapshot = options.buildSnapshot(subtitleIndex);
            snapshot.selectedWord = word.trim();
            await options.save(snapshot);
            await options.saved();
        } finally {
            saving = false;
        }
    };
}
