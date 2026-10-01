import { ApiPayload } from "../types/api.js";
import { apiJson, fetchWithRetry } from "../core/api.js";
import { JapaneseToken } from "../types/runtime-types.js";
import { buildJapaneseHighlightSpans, getTokenEnd, getTokenStart, resolveOverlappingAnkiMatches } from "./anki-match-model.js";
import { tokenizeJapaneseTextSync } from "../japanese/japanese-tokenizer.js";
import { getActiveSubtitleEntries, getActiveSubtitles, getCurrentSubtitle } from "../subtitles/timing.js";
import { renderSubtitleOverlay } from "../subtitles/subtitles.js";
import { overlay } from "../core/dom.js";
import { isKanjiContainingToken } from "../subtitles/comprehension-level.js";
import { getSubtitleHighlightSettings } from "./subtitles-highlighter.js";
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

export async function ankiRequest(ankiUrl: string, action: string, params: Record<string, unknown> = {}) {
    const res = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action,
            version: 6,
            params
        })
    }, {
        retries: 500,
        delayMs: 1000,
        label: `AnkiConnect ${action}`
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return data.result;
}

export function normalizeHighlightWord(value: unknown): string {
    return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
        return { ok: false, error: err?.message || String(err) };
    }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks = [];
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
        if (err?.name === "AbortError") {
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


export function findKnownRawMatchesInText(text: string, tokens: JapaneseToken[] | null = null): AnkiTextMatch[] {
    const source = String(text || "");
    const matches: AnkiTextMatch[] = [];

    if (!source) return matches;
    const starts = tokens ? new Set(tokens.map(getTokenStart)) : null;
    const ends = tokens ? new Set(tokens.map(getTokenEnd)) : null;

    for (const [word, info] of ankiRuntimeWordStatusMap.entries()) {
        const status = info.status;
        if (!status || status === "unknown") continue;

        const needle = normalizeHighlightWord(word);
        if (!needle) continue;

        let start = source.indexOf(needle);

        while (start !== -1) {
            const end = start + needle.length;
            const atBoundaries = starts && ends
                ? starts.has(start) && ends.has(end)
                : !/[\p{L}\p{N}\p{M}]$/u.test(source.slice(0, start))
                    && !/^[\p{L}\p{N}\p{M}]/u.test(source.slice(end));
            if (atBoundaries) {
                matches.push({ start, end, status });
            }

            start = source.indexOf(needle, start + 1);
        }
    }

    return matches;
}

export function collectSubtitleCandidates(text: string): string[] {
    const source = String(text || "");
    const tokens = tokenizeJapaneseTextSync?.(source);

    if (!tokens) return [];

    const spans = buildJapaneseHighlightSpans(tokens);
    const candidates = new Set<string>();

    for (const span of spans) {
        for (const rawCandidate of span.candidates || []) {
            const candidate = normalizeHighlightWord(rawCandidate);

            if (candidate && candidate !== "*") {
                candidates.add(candidate);
            }
        }
    }

    return [...candidates];
}

export async function ensureStatusesForSubtitleText(text: string, { rerender = true, silent = false } = {}) {
    await loadHighlightWordIndexes();

    if (!silent) {
        const candidates = collectSubtitleCandidates(text);
        const knownCount = candidates.filter((candidate) => ankiRuntimeWordStatusMap.has(candidate)).length;
        console.log(`Snapshot highlighter matched ${knownCount}/${candidates.length} subtitle candidates`);
    }

    if (rerender) {
        rerenderCurrentSubtitleWithAnkiHighlighter();
    }
}

export async function ensureStatusesForCandidates(candidates: string[], { silent = false } = {}) {
    await loadHighlightWordIndexes();

    if (!silent) {
        const uniqueCandidates = [...new Set(candidates)].filter(Boolean);
        const knownCount = uniqueCandidates.filter((candidate) => ankiRuntimeWordStatusMap.has(candidate)).length;
        console.log(`Snapshot batch matched ${knownCount}/${uniqueCandidates.length} candidates`);
    }
}

export function rerenderCurrentSubtitleWithAnkiHighlighter() {
    if (typeof overlay === "undefined") return;

    renderSubtitleOverlay({
        overlay,
        cues: getActiveSubtitles(),
        cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
        highlighter: ankiSubtitleHighlighter
    });
}

export function findAnkiMatchesInText(text: string): AnkiTextMatch[] {
    const source = String(text || "");
    const tokens = tokenizeJapaneseTextSync?.(source);
    const matches: AnkiTextMatch[] = findKnownRawMatchesInText(source, tokens);

    if (!tokens) {
        return resolveOverlappingAnkiMatches(matches);
    }

    const spans = buildJapaneseHighlightSpans(tokens);

    for (const span of spans) {
        let bestMatch = null;

        for (const candidate of span.candidates) {
            const info = ankiRuntimeWordStatusMap.get(candidate);
            if (!info || info.status === "unknown") continue;

            bestMatch = {
                start: span.start,
                end: span.end,
                status: info.status
            };

            break;
        }

        if (bestMatch) {
            matches.push(bestMatch);
        }
    }

    return resolveOverlappingAnkiMatches(matches);
}

export function isLearnedAnkiStatusForComprehension(status: AnkiWordStatus | undefined): boolean {
    return status === "young" || status === "mature";
}

export function getUnknownKanjiTokenCountForText(text: string): number {
    const source = String(text || "");
    const tokens = tokenizeJapaneseTextSync?.(source);

    if (!tokens) return 0;

    const learnedMatches = findAnkiMatchesInText(source)
        .filter((match) => isLearnedAnkiStatusForComprehension(match.status));
    let unknownCount = 0;

    for (const token of tokens) {
        const surface = String(token.surface_form || "");

        if (!isKanjiContainingToken(surface)) continue;

        const start = getTokenStart(token);
        const end = getTokenEnd(token);
        const coveredByLearnedMatch = learnedMatches.some((match) =>
            match.start <= start &&
            match.end >= end
        );

        if (!coveredByLearnedMatch) {
            unknownCount += 1;
        }
    }

    return unknownCount;
}

export const ankiSubtitleHighlighter = {
    get enabled() {
        return getSubtitleHighlightSettings().enabled;
    },

    get statusSettings() {
        return getSubtitleHighlightSettings().statusSettings;
    },

    getStatusForTextToken(token) {
        const clean = String(token || "")
            .trim()
            .replace(/[.,!?;:()[\]'"「」『』。、！？]/g, "");

        return ankiRuntimeWordStatusMap.get(clean)?.status || "unknown";
    },

    findMatchesInText(text) {
        return findAnkiMatchesInText(text);
    },

    getUnknownKanjiTokenCount(text) {
        return getUnknownKanjiTokenCountForText(text);
    }
};

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
