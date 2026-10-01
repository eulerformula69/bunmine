export type AnkiWordStatus = "mature" | "young" | "learning" | "new" | "suspended" | "unknown";

export interface AnkiRuntimeWordInfo {
    status?: AnkiWordStatus;
    source?: "known-basic" | "known-anki";
    noteId?: string | number;
    lastCheckedAt?: string;
    locked?: boolean;
    [key: string]: unknown;
}

export interface AnkiCardInfo {
    queue?: number;
    type?: number;
    interval?: number;
    ivl?: number;
}

export interface HighlightSpan {
    start: number;
    end: number;
    surface: string;
    candidates: string[];
}

export interface AnkiTextMatch {
    start: number;
    end: number;
    status: AnkiWordStatus;
}

export const ankiRuntimeWordStatusMap = new Map<string, AnkiRuntimeWordInfo>();

export const knownBasicWordsLoadedState = { value: false };

export const knownAnkiWordsLoadedState = { value: false };

export function clearRuntimeWordStatuses() {
    ankiRuntimeWordStatusMap.clear();
    knownBasicWordsLoadedState.value = false;
    knownAnkiWordsLoadedState.value = false;
}

export function getCardStatus(card: AnkiCardInfo): AnkiWordStatus {
    if (card.queue === -1) return "suspended";
    if (card.type === 0) return "new";
    if (card.type === 1 || card.queue === 1 || card.queue === 3) return "learning";

    const interval = Number(card.interval ?? card.ivl ?? 0);
    if (interval >= 21) return "mature";

    return "young";
}

export function pickBetterStatus(oldStatus: AnkiWordStatus | undefined, newStatus: AnkiWordStatus): AnkiWordStatus {
    const priority = {
        mature: 5,
        young: 4,
        learning: 3,
        new: 2,
        suspended: 1,
        unknown: 0
    };

    if (!oldStatus) return newStatus;
    return priority[newStatus] > priority[oldStatus] ? newStatus : oldStatus;
}

export function updateRuntimeKnownAnkiWords(words: unknown[], status: AnkiWordStatus | undefined, extraInfo: Partial<AnkiRuntimeWordInfo> = {}) {
    const normalizedStatus = status || "unknown";

    for (const rawWord of words || []) {
        const word = normalizeHighlightWord(rawWord);

        if (!word) continue;

        const prev = ankiRuntimeWordStatusMap.get(word);

        ankiRuntimeWordStatusMap.set(word, {
            ...(prev || {}),
            ...extraInfo,
            status: pickBetterStatus(prev?.status, normalizedStatus),
            source: prev?.source === "known-basic" ? "known-basic" : "known-anki"
        });
    }
}

export function normalizeHighlightWord(value: unknown): string {
    return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function addRuntimeKnownBasicWord(word: string) {
    const normalized = normalizeHighlightWord(word);

    if (!normalized) return;

    const prev = ankiRuntimeWordStatusMap.get(normalized);

    ankiRuntimeWordStatusMap.set(normalized, {
        ...(prev || {}),
        status: pickBetterStatus(prev?.status, "mature"),
        source: "known-basic"
    });
}
