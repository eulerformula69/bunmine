interface ActiveSubtitleContextDrag {
    kind: SubtitleDepthKind;
    currentIdx: number;
    pointerId: number;
    grabOffsetY: number;
    ghost: HTMLElement;
    lastTargetIndex: number;
    frameId: number | null;
    pendingClientY: number;
}

let activeSubtitleContextDrag: ActiveSubtitleContextDrag | null = null;

function initSubtitleContextDrag() {
    if (document.body.dataset.subtitleContextDragInitialized === "true") return;

    document.body.dataset.subtitleContextDragInitialized = "true";
    document.addEventListener("pointermove", onSubtitleContextDragMove);
    document.addEventListener("pointerup", stopSubtitleContextDrag);
    document.addEventListener("pointercancel", stopSubtitleContextDrag);
}

function startSubtitleContextDrag(kind: SubtitleDepthKind, event: PointerEvent) {
    if (!subtitles.length) return;

    const context = getSubtitleContextRange();
    if (context.currentIdx < 0) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    const rect = handle.getBoundingClientRect();
    const ghost = handle.cloneNode(true) as HTMLElement;
    ghost.classList.add("subtitle-depth-handle-ghost");
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);

    activeSubtitleContextDrag = {
        kind,
        currentIdx: context.currentIdx,
        pointerId: event.pointerId,
        grabOffsetY: event.clientY - rect.top,
        ghost,
        lastTargetIndex: kind === "back" ? context.startIdx : context.endIdx,
        frameId: null,
        pendingClientY: event.clientY
    };

    ghost.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = "row-resize";
    document.documentElement.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("subtitle-depth-dragging");
}

function onSubtitleContextDragMove(event: PointerEvent) {
    const drag = activeSubtitleContextDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    drag.pendingClientY = event.clientY;
    if (drag.frameId !== null) return;

    drag.frameId = requestAnimationFrame(() => {
        if (!activeSubtitleContextDrag) return;

        const currentDrag = activeSubtitleContextDrag;
        currentDrag.frameId = null;
        currentDrag.ghost.style.top = `${currentDrag.pendingClientY - currentDrag.grabOffsetY}px`;
        updateSubtitleContextDepthFromPointer(
            currentDrag.kind,
            currentDrag.pendingClientY,
            currentDrag.currentIdx
        );
    });
}

function stopSubtitleContextDrag(event: PointerEvent) {
    const drag = activeSubtitleContextDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.frameId !== null) cancelAnimationFrame(drag.frameId);
    activeSubtitleContextDrag = null;
    document.body.style.cursor = "";
    document.documentElement.style.cursor = "";
    document.body.style.userSelect = "auto";
    document.body.classList.remove("subtitle-depth-dragging");

    requestAnimationFrame(() => settleSubtitleContextDragGhost(drag));
}

function settleSubtitleContextDragGhost(drag: ActiveSubtitleContextDrag) {
    const target = document.querySelector<HTMLElement>(
        `.subtitle-depth-handle[data-kind="${drag.kind}"]`
    );

    if (!target) {
        drag.ghost.remove();
        return;
    }

    const targetRect = target.getBoundingClientRect();
    drag.ghost.classList.add("settling");
    drag.ghost.style.left = `${targetRect.left}px`;
    drag.ghost.style.top = `${targetRect.top}px`;
    drag.ghost.addEventListener("transitionend", () => drag.ghost.remove(), { once: true });
    window.setTimeout(() => drag.ghost.remove(), 240);
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
        if (activeSubtitleContextDrag?.lastTargetIndex === nearestIndex) return;
        if (activeSubtitleContextDrag) activeSubtitleContextDrag.lastTargetIndex = nearestIndex;
        setSubtitleContextDepths({ backDepth: Math.max(0, currentIdx - nearestIndex) });
        return;
    }

    if (activeSubtitleContextDrag?.lastTargetIndex === nearestIndex) return;
    if (activeSubtitleContextDrag) activeSubtitleContextDrag.lastTargetIndex = nearestIndex;
    setSubtitleContextDepths({ forwardDepth: Math.max(0, nearestIndex - currentIdx) });
}
