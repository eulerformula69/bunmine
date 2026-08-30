type SubtitleDepthKind = "back" | "forward";

interface SubtitleContextRangeLike {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
    backDepth: number;
    forwardDepth: number;
}

function applySubtitleRowState(
    row: HTMLElement,
    subtitleIndex: number,
    context: SubtitleContextRangeLike,
    currentSearchMatch: SubtitleSearchResult | null
): void {
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

function createSubtitleContextControls(context: SubtitleContextRangeLike): HTMLElement {
    const dict = i18n[currentLang]?.dict || i18n.en.dict;
    const controls = document.createElement("div");
    controls.className = "subtitle-context-controls";
    controls.setAttribute("aria-label", dict.subtitleContextLabel || "Card context");

    const createStepper = (
        kind: "back" | "forward",
        label: string,
        value: number,
        canAdd: boolean
    ) => {
        const group = document.createElement("div");
        group.className = "subtitle-context-stepper";

        const text = document.createElement("span");
        text.textContent = `${label} ${value}`;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "−";
        remove.disabled = value === 0;
        remove.setAttribute("aria-label", `${dict.removeFromContext || "Remove"}: ${label}`);

        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "+";
        add.disabled = !canAdd;
        add.setAttribute("aria-label", `${dict.addToContext || "Add"}: ${label}`);

        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            setSubtitleContextDepths(kind === "back"
                ? { backDepth: Math.max(0, value - 1) }
                : { forwardDepth: Math.max(0, value - 1) });
        });
        add.addEventListener("click", (event) => {
            event.stopPropagation();
            setSubtitleContextDepths(kind === "back"
                ? { backDepth: value + 1 }
                : { forwardDepth: value + 1 });
        });

        group.append(text, remove, add);
        return group;
    };

    controls.append(
        createStepper("back", dict.previousContext || "Previous", context.backDepth, context.startIdx > 0),
        createStepper("forward", dict.nextContext || "Next", context.forwardDepth, context.endIdx < subtitles.length - 1)
    );

    return controls;
}
