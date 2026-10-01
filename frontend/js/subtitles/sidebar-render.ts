import { SubtitleSearchResult } from "./search.js";
import { formatTime } from "./parsing.js";
import { RuntimeSubtitleCue } from "./model.js";
import { clearSearchMatches, getCurrentSearchMatch, getSubtitleContextRange, initSubtitleSearchPanel, syncSubtitleStyle } from "./subtitles-sidebar.js";
import { state } from "../core/state.js";
import { startSubtitleContextDrag } from "./context-drag.js";
import { overlay, video } from "../core/dom.js";
import { renderSubtitleOverlay } from "./subtitles.js";
import { ankiSubtitleHighlighter } from "../highlighter/anki-highlighter.js";
import { updatePlayButton } from "../player/ui.js";
export type SubtitleDepthKind = "back" | "forward";

export interface SubtitleContextRangeLike {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
}

export function applySubtitleRowState(
    row: HTMLElement,
    subtitleIndex: number,
    context: SubtitleContextRangeLike,
    currentSearchMatch: SubtitleSearchResult | null
): void {
    row.classList.toggle("search-active", currentSearchMatch?.subtitleIndex === subtitleIndex);
    row.classList.toggle("capture-range", context.currentIdx >= 0 &&
        subtitleIndex >= context.startIdx && subtitleIndex <= context.endIdx);
    row.classList.toggle("active", context.currentIdx >= 0 && subtitleIndex === context.currentIdx);
}

export function createSubtitleTimeContainer(startSeconds: number, endSeconds: number): HTMLElement {
    const timeContainer = document.createElement("div");
    timeContainer.className = "time-container";
    timeContainer.style.display = "flex";
    timeContainer.style.justifyContent = "space-between";
    timeContainer.style.fontSize = "14px";
    timeContainer.style.color = "#888";
    timeContainer.style.marginBottom = "10px";

    const startTime = document.createElement("span");
    startTime.textContent = formatTime(startSeconds);

    const endTime = document.createElement("span");
    endTime.textContent = formatTime(endSeconds);

    timeContainer.appendChild(startTime);
    timeContainer.appendChild(endTime);

    return timeContainer;
}

export function appendSubtitleTextWithSearchHighlight(
    container: HTMLElement,
    text: string,
    currentMatch: SubtitleSearchResult | null,
    subtitleIndex: number
): void {
    if (
        !currentMatch ||
        currentMatch.type !== "word" ||
        currentMatch.subtitleIndex !== subtitleIndex
    ) {
        container.textContent = text;
        return;
    }

    const before = text.slice(0, currentMatch.start);
    const matched = text.slice(currentMatch.start, currentMatch.end);
    const after = text.slice(currentMatch.end);

    container.appendChild(document.createTextNode(before));

    const mark = document.createElement("span");
    mark.className = "subtitle-search-match";
    mark.textContent = matched;
    container.appendChild(mark);

    container.appendChild(document.createTextNode(after));
}

export function createSubtitleDepthHandleElement(
    kind: SubtitleDepthKind,
    onStartDrag: (kind: SubtitleDepthKind, event: PointerEvent) => void
): HTMLElement {
    const row = document.createElement("div");
    row.className = "subtitle-depth-handle-row";
    row.dataset.kind = kind;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "subtitle-depth-handle";
    handle.dataset.kind = kind;
    handle.title = kind === "back" ? "Previous subtitles" : "Next subtitles";
    handle.setAttribute("aria-label", handle.title);
    handle.addEventListener("pointerdown", (event) => onStartDrag(kind, event));

    row.appendChild(handle);
    return row;
}

export const renderedSubtitleSourceState = { value: null as RuntimeSubtitleCue[] | null };
export const renderedSubtitleDelayState = { value: NaN };
export const renderedSubtitleListState = { value: null as HTMLElement | null };
export const renderedSubtitleContextState = { value: null as SubtitleContextRangeLike | null };
export const renderedSubtitleSearchState = { value: null as SubtitleSearchResult | null };

export function refreshSubtitleRows(): void {
    const context = getSubtitleContextRange();
    const match = getCurrentSearchMatch();
    const changed = new Set<number>();
    for (const range of [renderedSubtitleContextState.value, context]) {
        if (!range || range.currentIdx < 0) continue;
        changed.add(range.currentIdx);
        for (let index = range.startIdx; index <= range.endIdx; index++) changed.add(index);
    }
    if (renderedSubtitleSearchState.value) changed.add(renderedSubtitleSearchState.value.subtitleIndex);
    if (match) changed.add(match.subtitleIndex);
    for (const index of changed) {
        const row = state.subtitleElements[index];
        if (!row) continue;
        applySubtitleRowState(row.div, index, context, match);
        if (renderedSubtitleSearchState.value !== match &&
            (index === renderedSubtitleSearchState.value?.subtitleIndex || index === match?.subtitleIndex)) {
            const text = row.div.querySelector<HTMLElement>(".text-content");
            if (text) {
                text.replaceChildren();
                appendSubtitleTextWithSearchHighlight(text, row.sub.text, match, index);
            }
        }
        for (const kind of ["back", "forward"] as const) {
            const needed = context.currentIdx >= 0 &&
                index === (kind === "back" ? context.startIdx : context.endIdx);
            const handle = row.div.querySelector(`.subtitle-depth-handle-row[data-kind="${kind}"]`);
            if (needed && !handle) row.div.appendChild(createSubtitleDepthHandleElement(kind, startSubtitleContextDrag));
            if (!needed) handle?.remove();
        }
    }
    renderedSubtitleContextState.value = context;
    renderedSubtitleSearchState.value = match;
}

// rendering

export function renderSubtitles() {
    initSubtitleSearchPanel();

    const list = document.getElementById("subtitleList");
    if (!list) return;

    if (renderedSubtitleSourceState.value === state.subtitles && renderedSubtitleDelayState.value === state.globalSubDelay &&
        renderedSubtitleListState.value === list && state.subtitleElements.length === state.subtitles.length) {
        refreshSubtitleRows();
        return;
    }
    renderedSubtitleSourceState.value = state.subtitles;
    renderedSubtitleDelayState.value = state.globalSubDelay;
    renderedSubtitleListState.value = list;
    state.subtitleElements = [];
    const fragment = document.createDocumentFragment();

    const context = getSubtitleContextRange();
    const currentSearchMatch = getCurrentSearchMatch();

    state.subtitles.forEach((sub, idx) => {
        const div = document.createElement("div");

        div.className = "subtitle";
        div.dataset.index = String(idx);

        applySubtitleRowState(div, idx, context, currentSearchMatch);

        const timeContainer = createSubtitleTimeContainer(
            sub.start + state.globalSubDelay,
            sub.end + state.globalSubDelay
        );

        const textContent = document.createElement("div");
        textContent.className = "text-content";
        appendSubtitleTextWithSearchHighlight(textContent, sub.text, currentSearchMatch, idx);

        div.appendChild(timeContainer);
        div.appendChild(textContent);

        div.onclick = (event) => {
            if ((event.target as Element).closest(".subtitle-context-controls")) return;

            clearSearchMatches();
            state.lastClickedSubtitleIdx = idx;

            video.pause();
            video.currentTime = sub.start + state.globalSubDelay + 0.05;
            syncSubtitleStyle(idx);

            renderSubtitleOverlay({
                overlay,
                text: sub.text,
                highlighter: ankiSubtitleHighlighter
            });

            updatePlayButton();
        };

        if (context.currentIdx >= 0 && idx === context.startIdx) {
            div.appendChild(createSubtitleDepthHandleElement("back", startSubtitleContextDrag));
        }

        if (context.currentIdx >= 0 && idx === context.endIdx) {
            div.appendChild(createSubtitleDepthHandleElement("forward", startSubtitleContextDrag));
        }

        fragment.appendChild(div);
        state.subtitleElements.push({ index: idx, div, sub });
    });
    list.replaceChildren(fragment);
    renderedSubtitleContextState.value = context;
    renderedSubtitleSearchState.value = currentSearchMatch;
}
