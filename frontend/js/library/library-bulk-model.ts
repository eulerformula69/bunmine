interface BulkSubtitleSet {
    key: string;
    label: string;
    count: number;
    totalEpisodes: number;
    examples: string[];
    candidatesByEpisodeId: Map<string, SubtitleCandidate>;
}

const LibraryBulkModel = {
    candidateKey(candidate: SubtitleCandidate | null | undefined): string {
        return String(candidate?.downloadUrl || `${candidate?.entryId || ""}:${candidate?.filename || ""}`);
    },

    formatCandidate(candidate: SubtitleCandidate | null | undefined, formatBytes: (value: unknown) => string): string {
        if (!candidate) return "";
        return [
            candidate.filename,
            candidate.entryTitle,
            candidate.extension,
            formatBytes(candidate.sizeBytes),
            candidate.lastModified ? String(candidate.lastModified).slice(0, 10) : null,
        ].filter(Boolean).join(" · ");
    },

    getSets(plan: BulkSubtitlePlan | null | undefined, translate: LibraryTranslate): BulkSubtitleSet[] {
        const items = Array.isArray(plan?.items) ? plan.items : [];
        const totalEpisodes = items.filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
        const byKey = new Map<string, BulkSubtitleSet>();

        for (const item of items) {
            const usedForEpisode = new Set<string>();
            for (const candidate of item.candidates || []) {
                const releaseKey = String(candidate.releaseKey || candidate.entryTitle || "other");
                if (!releaseKey || usedForEpisode.has(releaseKey)) continue;
                usedForEpisode.add(releaseKey);

                if (!byKey.has(releaseKey)) {
                    byKey.set(releaseKey, {
                        key: releaseKey,
                        label: String(candidate.releaseLabel || candidate.entryTitle || translate("other")),
                        count: 0,
                        totalEpisodes,
                        examples: [],
                        candidatesByEpisodeId: new Map(),
                    });
                }
                const group = byKey.get(releaseKey)!;
                group.count += 1;
                group.candidatesByEpisodeId.set(String(item.episodeId), candidate);
                if (group.examples.length < 2) {
                    group.examples.push(String(candidate.filename || candidate.entryTitle || translate("subtitle")));
                }
            }
        }

        return [...byKey.values()].sort((left, right) => (
            right.count - left.count || left.label.localeCompare(right.label)
        ));
    },

    applySet(plan: BulkSubtitlePlan, releaseKey: string, translate: LibraryTranslate): void {
        for (const item of plan.items || []) {
            const candidates = item.candidates || [];
            const candidate = candidates.find((value) => (
                String(value.releaseKey || value.entryTitle || "other") === String(releaseKey)
            ));
            if (candidate) {
                item.selected = candidate;
                item.status = "ready";
                item.message = translate("selectedFromSubtitleSet");
            } else if (candidates.length) {
                item.selected = null;
                item.status = "needs-review";
                item.message = translate("noFileFromSelectedSet");
            }
        }
    },
};
