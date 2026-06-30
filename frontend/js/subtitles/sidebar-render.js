function applySubtitleRowState(row, subtitleIndex, context, currentSearchMatch) {
    if (currentSearchMatch?.subtitleIndex === subtitleIndex) {
        row.classList.add("search-active");
    }
    if (context.currentIdx >= 0 && subtitleIndex >= context.startIdx && subtitleIndex <= context.endIdx) {
        row.classList.add("capture-range");
    }
    if (context.currentIdx >= 0 && subtitleIndex === context.currentIdx) {
        row.classList.add("active");
    }
}
function createSubtitleTimeContainer(startSeconds, endSeconds) {
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
function appendSubtitleTextWithSearchHighlight(container, text, currentMatch, subtitleIndex) {
    if (!currentMatch ||
        currentMatch.type !== "word" ||
        currentMatch.subtitleIndex !== subtitleIndex) {
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
function createSubtitleDepthHandleElement(kind, onStartDrag) {
    const row = document.createElement("div");
    row.className = "subtitle-depth-handle-row";
    row.dataset.kind = kind;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "subtitle-depth-handle";
    handle.dataset.kind = kind;
    handle.title = kind === "back"
        ? "Previous subtitles"
        : "Next subtitles";
    handle.setAttribute("aria-label", handle.title);
    handle.addEventListener("mousedown", (event) => {
        onStartDrag(kind, event);
    });
    row.appendChild(handle);
    return row;
}
