import { MiningCandidate } from "./candidate-model.js";

import { AnkiMediaSnapshot } from "../anki/media-snapshot.js";

import { t } from "../core/translate.js";

import { candidateExports,candidatePanel } from "./candidate-bindings.js";

import { ankiMediaController } from "./controllers.js";

// Export data belongs to a candidate ID, never to the current video position.
export function createCandidateExportService(options: {
    source(id: number): Promise<MiningCandidate>;
    configure(snapshot: AnkiMediaSnapshot): void;
}) {
    const saves = new Map<number, Promise<unknown>>();
    return {
        trackSave<T>(id: number, save: Promise<T>): Promise<T> {
            saves.set(id, save);
            // Retain failures until a successful retry, so export cannot use stale bounds.
            void save.catch(() => {});
            return save;
        },
        async load(id: number): Promise<MiningCandidate> {
            let pending: Promise<unknown> | undefined;
            do {
                pending = saves.get(id);
                await pending;
            } while (pending !== saves.get(id));
            const candidate = await options.source(id);
            const snapshot = JSON.parse(JSON.stringify(candidate.snapshot)) as AnkiMediaSnapshot;
            options.configure(snapshot);
            snapshot.candidateId = candidate.id;
            snapshot.candidateRevision = candidate.revision;
            return { ...candidate, snapshot };
        },
        async validate(snapshot: AnkiMediaSnapshot): Promise<void> {
            if (snapshot.candidateId === undefined) return;
            await saves.get(snapshot.candidateId);
            const latest = await options.source(snapshot.candidateId);
            if (latest.revision !== snapshot.candidateRevision) throw new Error(t("candidateContextChanged"));
        },
    };
}

export async function resolveAnkiExportSnapshot(index?: number): Promise<AnkiMediaSnapshot> {
    const id = candidatePanel.exportCandidateId();
    if (id !== undefined) return (await candidateExports.load(id)).snapshot;
    return ankiMediaController.buildSnapshot({ subtitleIndex: index });
}
