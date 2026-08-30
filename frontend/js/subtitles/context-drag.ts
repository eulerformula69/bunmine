function initSubtitleContextDrag() {
    if (document.body.dataset.subtitleContextDragInitialized === "true") return;

    document.body.dataset.subtitleContextDragInitialized = "true";
    document.addEventListener("mousemove", onSubtitleContextDragMove);
    document.addEventListener("mouseup", stopSubtitleContextDrag);
}

function startSubtitleContextDrag(kind: SubtitleDepthKind, event: MouseEvent) {
    if (!subtitles.length) return;

    const context = getSubtitleContextRange();
    if (context.currentIdx < 0) return;

    event.preventDefault();
    event.stopPropagation();

    subtitleContextDragState = {
        kind,
        currentIdx: context.currentIdx,
        startY: event.clientY,
        activated: false
    };

    document.body.style.cursor = "row-resize";
    document.documentElement.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("subtitle-depth-dragging");
}

function onSubtitleContextDragMove(event: MouseEvent) {
    if (!subtitleContextDragState) return;

    const dragDeadZonePx = 14;
    const distanceY = Math.abs(event.clientY - subtitleContextDragState.startY);

    if (!subtitleContextDragState.activated) {
        if (distanceY < dragDeadZonePx) return;
        subtitleContextDragState.activated = true;
    }

    updateSubtitleContextDepthFromPointer(
        subtitleContextDragState.kind,
        event.clientY,
        subtitleContextDragState.currentIdx
    );
}

function stopSubtitleContextDrag() {
    if (!subtitleContextDragState) return;

    subtitleContextDragState = null;
    document.body.style.cursor = "";
    document.documentElement.style.cursor = "";
    document.body.style.userSelect = "auto";
    document.body.classList.remove("subtitle-depth-dragging");
}

function updateSubtitleContextDepthFromPointer(kind: SubtitleDepthKind, clientY: number, currentIdx: number) {
    if (!subtitleElements.length) return;

    const allowedElements = subtitleElements.filter(({ index }) => (
        kind === "back" ? index <= currentIdx : index >= currentIdx
    ));
    if (!allowedElements.length) return;

    let nearestIndex = allowedElements[0].index;
    let nearestDistance = Infinity;

    allowedElements.forEach(({ div, index }) => {
        const rect = div.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.height / 2) - clientY);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    if (kind === "back") {
        setSubtitleContextDepths({ backDepth: Math.max(0, currentIdx - nearestIndex) });
        return;
    }

    setSubtitleContextDepths({ forwardDepth: Math.max(0, nearestIndex - currentIdx) });
}
