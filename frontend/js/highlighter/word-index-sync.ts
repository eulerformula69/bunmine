import { ApiPayload } from "../types/api.js";

import { AnkiRuntimeWordInfo,ankiRuntimeWordStatusMap,AnkiWordStatus,clearRuntimeWordStatuses,knownAnkiWordsLoadedState,knownBasicWordsLoadedState,normalizeHighlightWord,pickBetterStatus,updateRuntimeKnownAnkiWords } from "./word-status-store.js";

import { apiJson } from "../core/api.js";

import { rerenderCurrentSubtitleWithAnkiHighlighter } from "./anki-highlighter.js";

export interface KnownAnkiWordsPayload extends ApiPayload {
    data?: {
        words?: Record<string, AnkiRuntimeWordInfo>;
    };
}

export interface KnownWordsPayload extends ApiPayload {
    words?: unknown[];
}

export interface KnownAnkiRefreshNotePayload extends ApiPayload {
    words?: unknown[];
    status?: AnkiWordStatus;
    noteId?: string | number;
    updatedAt?: string;
}

export function getHighlightWordFieldNames() {
    const raw = (document.getElementById("highlightWordField") as HTMLInputElement | null)?.value || "Word";

    return raw
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
}

export function getHighlightDeckNames() {
    const raw = (document.getElementById("highlightDeckNames") as HTMLInputElement | null)?.value
        || (document.getElementById("deckName") as HTMLInputElement | null)?.value
        || "";

    return raw
        .split(",")
        .map((deck) => deck.trim())
        .filter(Boolean);
}

export function escapeAnkiSearchValue(value: unknown): string {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}

export function buildCurrentDeckQuery() {
    const deckNames = getHighlightDeckNames();

    return deckNames
        .map((deck) => `deck:"${escapeAnkiSearchValue(deck)}"`)
        .join(" OR ");
}

export async function loadKnownBasicWords({ force = false } = {}) {
    if (knownBasicWordsLoadedState.value && !force) return;

    try {
        const { response, data } = await apiJson<KnownWordsPayload>("/known-basic-words");

        if (!response.ok || data.error) {
            throw new Error(String(data.error || "Known basic words load failed"));
        }

        const words = Array.isArray(data.words) ? data.words : [];

        for (const rawWord of words) {
            const word = normalizeHighlightWord(rawWord);
            if (!word) continue;

            const prev = ankiRuntimeWordStatusMap.get(word);

            ankiRuntimeWordStatusMap.set(word, {
                ...(prev || {}),
                status: pickBetterStatus(prev?.status, "mature"),
                source: "known-basic"
            });
        }

        knownBasicWordsLoadedState.value = true;
        console.log(`Known basic words loaded: ${words.length}`);
    } catch (err) {
        console.warn("Known basic words load failed:", err);
    }
}

export async function loadKnownAnkiWords({ force = false } = {}) {
    if (knownAnkiWordsLoadedState.value && !force) return;

    try {
        const { response, data } = await apiJson<KnownAnkiWordsPayload>("/known-anki-words");

        if (!response.ok || data.error) {
            throw new Error(String(data.error || "Known Anki words load failed"));
        }

        const words = data?.data?.words && typeof data.data.words === "object"
            ? data.data.words
            : {};

        let loadedCount = 0;

        for (const [rawWord, rawInfo] of Object.entries(words)) {
            const word = normalizeHighlightWord(rawWord);
            if (!word) continue;

            const info = rawInfo && typeof rawInfo === "object" ? rawInfo as AnkiRuntimeWordInfo : {};
            const status = info.status || "unknown";
            const prev = ankiRuntimeWordStatusMap.get(word);

            ankiRuntimeWordStatusMap.set(word, {
                ...(prev || {}),
                ...info,
                status: pickBetterStatus(prev?.status, status),
                source: prev?.source === "known-basic" ? "known-basic" : "known-anki"
            });

            loadedCount += 1;
        }

        knownAnkiWordsLoadedState.value = true;
        console.log(`Known Anki words loaded: ${loadedCount}`);
    } catch (err) {
        console.warn("Known Anki words load failed:", err);
    }
}

export async function loadHighlightWordIndexes({ force = false } = {}) {
    await loadKnownAnkiWords({ force });
    await loadKnownBasicWords({ force });
}

export async function checkKnownAnkiWordsStaleOnPlayerOpen({ silent = true } = {}) {

    try {
        const { response, data } = await apiJson("/known-anki-words/stale-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context: "player" })
        });

        if (!response.ok || data?.error) {
            throw new Error(String(data?.error || "Anki highlight stale-check failed"));
        }

        if (!data?.skipped) {
            clearRuntimeWordStatuses();
            await loadHighlightWordIndexes({ force: true });
        }

        if (!silent) {
            console.log("Anki highlight player stale-check:", data);
        }

        return data;
    } catch (err) {
        console.warn("Anki highlight player stale-check failed:", err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

export async function refreshKnownAnkiWordsFromAnki({ fullRebuild = false } = {}) {
    const ankiUrl = (document.getElementById("ankiUrl") as HTMLInputElement | null)?.value?.trim();
    const autoRefresh = (document.getElementById("ankiHighlightAutoRefreshInterval") as HTMLSelectElement | null)?.value || "daily";
    const wordFields = getHighlightWordFieldNames();
    const deckNames = getHighlightDeckNames();

    if (!ankiUrl || !deckNames.length || !wordFields.length) {
        throw new Error("Set AnkiConnect URL, highlight decks and word fields first.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let response;
    let data;
    try {
        ({ response, data } = await apiJson("/known-anki-words/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                ankiUrl,
                decks: deckNames,
                wordFields,
                autoRefresh,
                fullRebuild
            })
        }));
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error("Anki highlight refresh timed out after 120 seconds. Check that Anki is open and AnkiConnect is responding.");
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok || data.error) {
        throw new Error(String(data.error || "Failed to refresh known-anki-words.json"));
    }

    clearRuntimeWordStatuses();
    await loadHighlightWordIndexes({ force: true });

    return data;
}

export async function refreshKnownAnkiWordFromNote({
    noteId,
    word = "",
    wordFields = null
}: {
    noteId?: string | number;
    word?: string;
    wordFields?: string[] | null;
} = {}) {
    const ankiUrl = (document.getElementById("ankiUrl") as HTMLInputElement | null)?.value?.trim();
    const fields = Array.isArray(wordFields) && wordFields.length
        ? wordFields
        : getHighlightWordFieldNames();

    if (!ankiUrl) {
        throw new Error("Set AnkiConnect URL first.");
    }
    if (!noteId && !word) {
        throw new Error("noteId or word is required.");
    }

    const { response, data } = await apiJson<KnownAnkiRefreshNotePayload>("/known-anki-words/refresh-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ankiUrl,
            noteId,
            word,
            wordFields: fields
        })
    });

    if (!response.ok || data?.error) {
        throw new Error(String(data?.error || "Failed to refresh Anki highlight word"));
    }

    updateRuntimeKnownAnkiWords(data.words || [word], data.status, {
        noteId: data.noteId,
        lastCheckedAt: data.updatedAt,
        locked: data.status === "mature"
    });

    knownAnkiWordsLoadedState.value = false;
    rerenderCurrentSubtitleWithAnkiHighlighter();

    return data;
}
