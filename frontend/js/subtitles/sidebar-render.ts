type SubtitleDepthKind = "back" | "forward";

interface SubtitleContextRangeLike {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
}

function applySubtitleRowState(
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

function createSubtitleTimeContainer(startSeconds: number, endSeconds: number): HTMLElement {
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

function appendSubtitleTextWithSearchHighlight(
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

function createSubtitleDepthHandleElement(
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

let renderedSubtitleSource: RuntimeSubtitleCue[] | null = null;
let renderedSubtitleDelay = NaN;
let renderedSubtitleList: HTMLElement | null = null;
let renderedSubtitleContext: SubtitleContextRangeLike | null = null;
let renderedSubtitleSearch: SubtitleSearchResult | null = null;

function refreshSubtitleRows(): void {
    const context = getSubtitleContextRange();
    const match = getCurrentSearchMatch();
    const changed = new Set<number>();
    for (const range of [renderedSubtitleContext, context]) {
        if (!range || range.currentIdx < 0) continue;
        changed.add(range.currentIdx);
        for (let index = range.startIdx; index <= range.endIdx; index++) changed.add(index);
    }
    if (renderedSubtitleSearch) changed.add(renderedSubtitleSearch.subtitleIndex);
    if (match) changed.add(match.subtitleIndex);
    for (const index of changed) {
        const row = subtitleElements[index];
        if (!row) continue;
        applySubtitleRowState(row.div, index, context, match);
        if (renderedSubtitleSearch !== match &&
            (index === renderedSubtitleSearch?.subtitleIndex || index === match?.subtitleIndex)) {
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
    renderedSubtitleContext = context;
    renderedSubtitleSearch = match;
}

// rendering

function renderSubtitles() {
    initSubtitleSearchPanel();

    const list = document.getElementById("subtitleList");
    if (!list) return;

    if (renderedSubtitleSource === subtitles && renderedSubtitleDelay === globalSubDelay &&
        renderedSubtitleList === list && subtitleElements.length === subtitles.length) {
        refreshSubtitleRows();
        return;
    }
    renderedSubtitleSource = subtitles;
    renderedSubtitleDelay = globalSubDelay;
    renderedSubtitleList = list;
    subtitleElements = [];
    const fragment = document.createDocumentFragment();

    const context = getSubtitleContextRange();
    const currentSearchMatch = getCurrentSearchMatch();

    subtitles.forEach((sub, idx) => {
        const div = document.createElement("div");

        div.className = "subtitle";
        div.dataset.index = String(idx);

        applySubtitleRowState(div, idx, context, currentSearchMatch);

        const timeContainer = createSubtitleTimeContainer(
            sub.start + globalSubDelay,
            sub.end + globalSubDelay
        );

        const textContent = document.createElement("div");
        textContent.className = "text-content";
        appendSubtitleTextWithSearchHighlight(textContent, sub.text, currentSearchMatch, idx);

        div.appendChild(timeContainer);
        div.appendChild(textContent);

        div.onclick = (event) => {
            if ((event.target as Element).closest(".subtitle-context-controls")) return;

            clearSearchMatches();
            lastClickedSubtitleIdx = idx;

            video.pause();
            video.currentTime = sub.start + globalSubDelay + 0.05;
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
        subtitleElements.push({ index: idx, div, sub });
    });
    list.replaceChildren(fragment);
    renderedSubtitleContext = context;
    renderedSubtitleSearch = currentSearchMatch;
}
