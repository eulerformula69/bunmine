import { RuntimeSubtitleCue } from "./model.js";

import { state } from "../core/state.js";

import { getCurrentSubtitleIndexForNavigation } from "./sidebar-actions.js";

import { buildSubtitleContextSelection } from "./context-selection.js";

import { isSubtitleContextDragging } from "./context-drag.js";

import { restoreSubtitleFromCurrentTime } from "./subtitles-sidebar.js";

// subtitle context

export interface SubtitleContextRange {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
    backDepth: number;
    forwardDepth: number;
}

export interface SubtitleContextSelectionState extends SubtitleContextRange {
    items: RuntimeSubtitleCue[];
    text: string;
    startTime: number;
    endTime: number;
}

export function normalizeSubtitleContextDepth(value: unknown): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return 0;

    return Math.max(0, Math.floor(numericValue));
}

export function getSubtitleContextRange(currentIdx: number | null = null): SubtitleContextRange {
    const resolvedCurrentIdx = currentIdx !== null && Number.isInteger(currentIdx)
        ? currentIdx
        : (
            state.lastClickedSubtitleIdx !== null && Number.isInteger(state.lastClickedSubtitleIdx) &&
            state.lastClickedSubtitleIdx >= 0 &&
            state.lastClickedSubtitleIdx < state.subtitles.length
                ? state.lastClickedSubtitleIdx
                : getCurrentSubtitleIndexForNavigation()
        );

    if (!state.subtitles.length || resolvedCurrentIdx < 0 || resolvedCurrentIdx >= state.subtitles.length) {
        return {
            currentIdx: -1,
            startIdx: -1,
            endIdx: -1,
            backDepth: 0,
            forwardDepth: 0
        };
    }

    const backDepth = normalizeSubtitleContextDepth(state.subtitleContextBackDepth);
    const forwardDepth = normalizeSubtitleContextDepth(state.subtitleContextForwardDepth);

    return {
        currentIdx: resolvedCurrentIdx,
        startIdx: Math.max(0, resolvedCurrentIdx - backDepth),
        endIdx: Math.min(state.subtitles.length - 1, resolvedCurrentIdx + forwardDepth),
        backDepth,
        forwardDepth
    };
}

export function getSubtitleContextSelection(currentIdx: number | null = null): SubtitleContextSelectionState {
    const range = getSubtitleContextRange(currentIdx);

    if (range.currentIdx < 0) {
        return {
            ...range,
            items: [],
            text: "",
            startTime: 0,
            endTime: 0
        };
    }

    const selection = buildSubtitleContextSelection(
        state.subtitles,
        range.currentIdx,
        range.backDepth,
        range.forwardDepth
    );
    const items = state.subtitles.slice(range.startIdx, range.endIdx + 1);

    return {
        ...range,
        items,
        text: selection?.text ?? "",
        startTime: selection?.startTime ?? 0,
        endTime: selection?.endTime ?? 0
    };
}

export function setSubtitleContextDepths({
    backDepth = state.subtitleContextBackDepth,
    forwardDepth = state.subtitleContextForwardDepth
}: {
    backDepth?: number;
    forwardDepth?: number;
} = {}) {
    state.subtitleContextBackDepth = normalizeSubtitleContextDepth(backDepth);
    state.subtitleContextForwardDepth = normalizeSubtitleContextDepth(forwardDepth);

    if (isSubtitleContextDragging()) {
        updateSubtitleContextRangePreview();
        return;
    }

	requestAnimationFrame(() => {
		restoreSubtitleFromCurrentTime();
	});
}

export function updateSubtitleContextRangePreview() {
    const context = getSubtitleContextRange();

    state.subtitleElements.forEach(({ div, index }) => {
        const isInRange = context.currentIdx >= 0 && index >= context.startIdx && index <= context.endIdx;
        div.classList.toggle("capture-range", isInRange);
        div.classList.toggle("active", index === context.currentIdx);
    });
}

export function resetSubtitleContextDepths() {
    setSubtitleContextDepths({
        backDepth: 0,
        forwardDepth: 0
    });
}

export function isSubtitleContextDepthDefault() {
    return state.subtitleContextBackDepth === 0 && state.subtitleContextForwardDepth === 0;
}
