import { JapaneseToken } from "../types/runtime-types.js";

import { AnkiTextMatch,AnkiWordStatus,ankiRuntimeWordStatusMap,normalizeHighlightWord } from "./word-status-store.js";

import { buildJapaneseHighlightSpans,getTokenEnd,getTokenStart,resolveOverlappingAnkiMatches } from "./anki-match-model.js";

import { tokenizeJapaneseTextSync } from "../japanese/japanese-tokenizer.js";

import { loadHighlightWordIndexes } from "./word-index-sync.js";

import { overlay } from "../core/dom.js";

import { renderSubtitleOverlay } from "../subtitles/subtitles.js";

import { getActiveSubtitleEntries,getActiveSubtitles } from "../subtitles/timing.js";

import { isKanjiContainingToken } from "../subtitles/comprehension-level.js";

import { getSubtitleHighlightSettings } from "./subtitles-highlighter.js";

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
        let bestMatch: AnkiTextMatch | null = null;

        for (const candidate of span.candidates) {
            const info = ankiRuntimeWordStatusMap.get(candidate);
            if (!info || info.status === "unknown") continue;

            bestMatch = {
                start: span.start,
                end: span.end,
                status: info.status ?? "unknown"
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

    getStatusForTextToken(token: string) {
        const clean = String(token || "")
            .trim()
            .replace(/[.,!?;:()[\]'"「」『』。、！？]/g, "");

        return ankiRuntimeWordStatusMap.get(clean)?.status || "unknown";
    },

    findMatchesInText(text: string) {
        return findAnkiMatchesInText(text);
    },

    getUnknownKanjiTokenCount(text: string) {
        return getUnknownKanjiTokenCountForText(text);
    }
};
