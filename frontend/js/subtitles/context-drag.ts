import { SubtitleDepthKind,renderSubtitles } from "./sidebar-render.js";

import { state } from "../core/state.js";

import { getSubtitleContextRange,setSubtitleContextDepths } from "./context-range.js";

export interface ActiveSubtitleContextDrag {
    kind: SubtitleDepthKind;
    currentIdx: number;
    pointerId: number;
    startClientY: number;
    ghost: HTMLElement;
    lastTargetIndex: number;
    frameId: number | null;
    pendingClientY: number;
}

export const activeSubtitleContextDragState = { value: null as ActiveSubtitleContextDrag | null };

export function isSubtitleContextDragging(): boolean {
    return activeSubtitleContextDragState.value !== null;
}

export function initSubtitleContextDrag() {
    if (document.body.dataset.subtitleContextDragInitialized === "true") return;

    document.body.dataset.subtitleContextDragInitialized = "true";
    document.addEventListener("pointermove", onSubtitleContextDragMove);
    document.addEventListener("pointerup", stopSubtitleContextDrag);
    document.addEventListener("pointercancel", stopSubtitleContextDrag);
}

export function startSubtitleContextDrag(kind: SubtitleDepthKind, event: PointerEvent) {
    if (!state.subtitles.length) return;

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

    activeSubtitleContextDragState.value = {
        kind,
        currentIdx: context.currentIdx,
        pointerId: event.pointerId,
        startClientY: event.clientY,
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
    document.body.dataset.subtitleDepthDragKind = kind;
}

export function onSubtitleContextDragMove(event: PointerEvent) {
    const drag = activeSubtitleContextDragState.value;
    if (!drag || event.pointerId !== drag.pointerId) return;

    drag.pendingClientY = event.clientY;
    if (drag.frameId !== null) return;

    drag.frameId = requestAnimationFrame(() => {
        if (!activeSubtitleContextDragState.value) return;

        const currentDrag = activeSubtitleContextDragState.value;
        currentDrag.frameId = null;
        currentDrag.ghost.style.transform = `translateY(${currentDrag.pendingClientY - currentDrag.startClientY}px)`;
        updateSubtitleContextDepthFromPointer(
            currentDrag.kind,
            currentDrag.pendingClientY,
            currentDrag.currentIdx
        );
    });
}

export function stopSubtitleContextDrag(event: PointerEvent) {
    const drag = activeSubtitleContextDragState.value;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.frameId !== null) cancelAnimationFrame(drag.frameId);
    drag.ghost.style.transform = `translateY(${event.clientY - drag.startClientY}px)`;
    updateSubtitleContextDepthFromPointer(drag.kind, event.clientY, drag.currentIdx);
    activeSubtitleContextDragState.value = null;
    document.body.style.cursor = "";
    document.documentElement.style.cursor = "";
    document.body.style.userSelect = "auto";
    document.body.classList.remove("subtitle-depth-dragging");

    renderSubtitles();
    requestAnimationFrame(() => settleSubtitleContextDragGhost(drag));
}

export function settleSubtitleContextDragGhost(drag: ActiveSubtitleContextDrag) {
    const target = document.querySelector<HTMLElement>(
        `.subtitle-depth-handle[data-kind="${drag.kind}"]`
    );

    if (!target) {
        finishSubtitleContextDragGhost(drag.ghost);
        return;
    }

    const targetRect = target.getBoundingClientRect();
    drag.ghost.classList.add("settling");
    drag.ghost.style.transform = `translateY(${targetRect.top - Number.parseFloat(drag.ghost.style.top)}px)`;
    drag.ghost.addEventListener("transitionend", () => finishSubtitleContextDragGhost(drag.ghost), { once: true });
    window.setTimeout(() => finishSubtitleContextDragGhost(drag.ghost), 240);
}

export function finishSubtitleContextDragGhost(ghost: HTMLElement) {
    ghost.remove();
    delete document.body.dataset.subtitleDepthDragKind;
}

export function updateSubtitleContextDepthFromPointer(kind: SubtitleDepthKind, clientY: number, currentIdx: number) {
    if (!state.subtitleElements.length) return;

    const allowedElements = state.subtitleElements.filter(({ index }) => (
        kind === "back" ? index <= currentIdx : index >= currentIdx
    ));
    if (!allowedElements.length) return;

    let nearestIndex = allowedElements[0].index;
    let nearestDistance = Infinity;

    allowedElements.forEach(({ div, index }) => {
        const rect = div.getBoundingClientRect();
        const boundaryY = kind === "back" ? rect.top : rect.bottom;
        const distance = Math.abs(boundaryY - clientY);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    if (kind === "back") {
        if (activeSubtitleContextDragState.value?.lastTargetIndex === nearestIndex) return;
        if (activeSubtitleContextDragState.value) activeSubtitleContextDragState.value.lastTargetIndex = nearestIndex;
        setSubtitleContextDepths({ backDepth: Math.max(0, currentIdx - nearestIndex) });
        return;
    }

    if (activeSubtitleContextDragState.value?.lastTargetIndex === nearestIndex) return;
    if (activeSubtitleContextDragState.value) activeSubtitleContextDragState.value.lastTargetIndex = nearestIndex;
    setSubtitleContextDepths({ forwardDepth: Math.max(0, nearestIndex - currentIdx) });
}
