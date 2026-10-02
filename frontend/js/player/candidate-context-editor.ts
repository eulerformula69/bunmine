import { MiningCandidate } from "./candidate-model.js";

import { CandidateContext,candidateContextSnapshot } from "./candidate-context-model.js";

import { formatTime } from "../core/formatters.js";

import { t } from "../core/translate.js";

import { createSubtitleTimeContainer } from "../subtitles/sidebar-render.js";

export function createCandidateContextEditor(options: {
    change(start: number, end: number): Promise<void>;
    editing(active: boolean): void;
    error(error: unknown): void;
}) {
    const element = document.createElement("section");
    element.className = "candidate-context-editor";
    const heading = document.createElement("h3");
    const viewport = document.createElement("div");
    viewport.className = "candidate-cues";
    const fallback = document.createElement("p");
    fallback.className = "candidate-context";
    const summary = document.createElement("div");
    summary.className = "candidate-context-summary";
    const timing = document.createElement("span");
    const saved = document.createElement("span");
    saved.setAttribute("role", "status");
    summary.append(timing, saved);
    element.append(heading, viewport, fallback, summary);
    const handles = ["start", "end"].map((kind) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "candidate-boundary";
        handle.dataset.boundary = kind;
        return handle;
    });
    let candidate: MiningCandidate | undefined;
    let context: CandidateContext | null = null;
    let rows: HTMLElement[] = [];
    let start = 0;
    let end = 0;
    let disabled = false;
    let saving = false;
    let paintedStart = -1;
    let paintedEnd = -1;
    let pendingFocus = false;
    let drag: { kind: number; pointerId: number; y: number; frame: number } | null = null;

    function paint(): void {
        if (!candidate) return;
        const snapshot = context ? candidateContextSnapshot(candidate.snapshot, context, start, end) : candidate.snapshot;
        timing.textContent = `${formatTime(snapshot.audioStart)} — ${formatTime(snapshot.audioEnd)} · ${(snapshot.audioEnd - snapshot.audioStart).toFixed(2)} ${t("candidateSeconds")}`;
        saved.textContent = saving ? t("candidateSaving") : drag ? t("candidateEditing") : t("candidateSavedShort");
        if (start !== paintedStart || end !== paintedEnd) {
            const from = paintedStart < 0 ? start : Math.min(start, paintedStart);
            const to = Math.max(end, paintedEnd);
            for (let index = from; index <= to; index++) {
                rows[index]?.classList.toggle("selected", index >= start && index <= end);
            }
            paintedStart = start;
            paintedEnd = end;
        }
        handles.forEach((handle, kind) => {
            const row = rows[kind === 0 ? start : end];
            if (row) handle.style.top = `${row.offsetTop + (kind === 0 ? 0 : row.offsetHeight) - 11}px`;
            handle.disabled = disabled || saving;
            handle.setAttribute("aria-label", t(kind === 0 ? "candidateStartBoundary" : "candidateEndBoundary"));
            handle.title = t("candidateBoundaryHelp");
        });
    }
    async function commit(): Promise<void> {
        if (!context || (start === context.start && end === context.end)) {
            options.editing(false);
            paint();
            return;
        }
        saving = true;
        paint();
        try { await options.change(start, end); }
        catch (error) {
            start = context.start;
            end = context.end;
            options.error(error);
        } finally {
            saving = false;
            options.editing(false);
            paint();
        }
    }
    function moveBoundary(kind: number, y: number): void {
        if (!context || !rows.length) return;
        const position = y - viewport.getBoundingClientRect().top + viewport.scrollTop;
        let low = kind === 0 ? 0 : context.anchor;
        let high = kind === 0 ? context.anchor : rows.length - 1;
        const boundary = (index: number) => rows[index].offsetTop + (kind === 0 ? 0 : rows[index].offsetHeight);
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (boundary(middle) < position) low = middle + 1;
            else high = middle;
        }
        const minimum = kind === 0 ? 0 : context.anchor;
        const index = low > minimum && Math.abs(boundary(low - 1) - position) < Math.abs(boundary(low) - position) ? low - 1 : low;
        if (kind === 0) start = index; else end = index;
        paint();
    }
    function autoScroll(): void {
        if (!drag) return;
        const bounds = viewport.getBoundingClientRect();
        if (drag.y < bounds.top + 30) viewport.scrollTop -= 8;
        if (drag.y > bounds.bottom - 30) viewport.scrollTop += 8;
        moveBoundary(drag.kind, drag.y);
        drag.frame = requestAnimationFrame(autoScroll);
    }
    function finish(cancel: boolean): void {
        if (!drag) return;
        cancelAnimationFrame(drag.frame);
        const pointerId = drag.pointerId;
        drag = null;
        viewport.classList.remove("dragging");
        if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
        if (cancel && context) {
            start = context.start;
            end = context.end;
            options.editing(false);
            paint();
        } else void commit();
    }
    handles.forEach((handle, kind) => {
        handle.addEventListener("pointerdown", (event) => {
            if (disabled || saving || !context || event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            drag = { kind, pointerId: event.pointerId, y: event.clientY, frame: 0 };
            viewport.setPointerCapture(event.pointerId);
            viewport.classList.add("dragging");
            options.editing(true);
            drag.frame = requestAnimationFrame(autoScroll);
        });
        handle.addEventListener("keydown", (event) => {
            if (!context || disabled || saving || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const delta = event.key === "ArrowUp" ? -1 : 1;
            if (kind === 0) start = Math.max(0, Math.min(context.anchor, start + delta));
            else end = Math.max(context.anchor, Math.min(rows.length - 1, end + delta));
            options.editing(true);
            void commit();
        });
    });
    viewport.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag.y = event.clientY;
        moveBoundary(drag.kind, drag.y);
    });
    viewport.addEventListener("pointerup", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        moveBoundary(drag.kind, event.clientY);
        finish(false);
    });
    viewport.addEventListener("pointercancel", () => finish(true));
    viewport.addEventListener("lostpointercapture", () => finish(true));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && drag) { event.preventDefault(); finish(true); }
    });
    function focusAnchor(): void {
        if (!pendingFocus || !context || !viewport.clientHeight) return;
        const row = rows[context.anchor];
        if (!row?.offsetHeight) return;
        viewport.scrollTop = Math.max(0, row.offsetTop - (viewport.clientHeight - row.offsetHeight) / 2);
        pendingFocus = false;
    }
    const resize = new ResizeObserver(() => { paint(); focusAnchor(); });
    resize.observe(viewport);
    return {
        element,
        focus(): void { pendingFocus = true; requestAnimationFrame(focusAnchor); },
        set(value: MiningCandidate | undefined, nextContext: CandidateContext | null, blocked: boolean): void {
            heading.textContent = t("candidateContextTitle");
            element.hidden = !value;
            disabled = blocked;
            const rebuild = candidate?.id !== value?.id || context !== nextContext;
            const changedCandidate = candidate?.id !== value?.id;
            if (changedCandidate || (!context && nextContext)) pendingFocus = true;
            candidate = value;
            context = nextContext;
            if (!value) { viewport.replaceChildren(); rows = []; return; }
            fallback.hidden = Boolean(context);
            fallback.textContent = `${value.snapshot.combinedText}\n\n${t("candidateContextUnavailable")}`;
            viewport.hidden = !context;
            if (rebuild && context) {
                const scroll = viewport.scrollTop;
                start = context.start;
                end = context.end;
                paintedStart = paintedEnd = -1;
                const anchor = context.anchor;
                rows = context.cues.map((cue, index) => {
                    const row = document.createElement("div");
                    row.className = "candidate-cue";
                    row.dataset.index = String(index);
                    row.classList.toggle("anchor", index === anchor);
                    const times = createSubtitleTimeContainer(cue.start, cue.end);
                    times.className = "candidate-cue-times";
                    const text = document.createElement("div");
                    text.textContent = cue.text;
                    row.append(times, text);
                    return row;
                });
                viewport.replaceChildren(...rows, ...handles);
                viewport.scrollTop = scroll;
            }
            paint();
            requestAnimationFrame(focusAnchor);
        },
    };
}
