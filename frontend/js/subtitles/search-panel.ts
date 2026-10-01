import { t } from "../core/translate.js";

import { formatTime } from "../core/formatters.js";

export interface SubtitleSearchPanelCallbacks {
    onWordFocus(wordInput: HTMLInputElement, timeInput: HTMLInputElement | null): void;
    onTimeFocus(wordInput: HTMLInputElement | null, timeInput: HTMLInputElement): void;
    onWordInput(value: string, timeInput: HTMLInputElement | null): void;
    onWordEnter(event: KeyboardEvent, value: string): void;
    onTimeInput(value: string, wordInput: HTMLInputElement | null): void;
    onTimeEnter(event: KeyboardEvent): void;
    onPrevious(): void;
    onNext(): void;
    onCommit(): void;
}

export interface SubtitleSearchPanelState {
    query: string;
    timeSeconds: number | null;
}

export function ensureSubtitleSearchPanel(
    sidebarEl: HTMLElement | null,
    state: SubtitleSearchPanelState,
    callbacks: SubtitleSearchPanelCallbacks
): void {
    if (!sidebarEl) return;

    let list = document.getElementById("subtitleList");

    if (!list) {
        list = document.createElement("div");
        list.id = "subtitleList";
        sidebarEl.appendChild(list);
    }

    if (document.getElementById("subtitleSearchPanel")) return;

    const panel = document.createElement("div");
    panel.id = "subtitleSearchPanel";

    panel.innerHTML = `
        <input
            id="subtitleWordSearchInput"
            type="text"
            autocomplete="off"
        />
        <button id="subtitleSearchPrevBtn" type="button">↑</button>
        <button id="subtitleSearchNextBtn" type="button">↓</button>
        <input
            id="subtitleTimeSearchInput"
            type="text"
            autocomplete="off"
        />
        <button id="subtitleSearchCommitBtn" type="button">↵</button>
    `;

    sidebarEl.appendChild(panel);

    const wordInput = panel.querySelector<HTMLInputElement>("#subtitleWordSearchInput");
    const timeInput = panel.querySelector<HTMLInputElement>("#subtitleTimeSearchInput");
    const prevBtn = panel.querySelector<HTMLButtonElement>("#subtitleSearchPrevBtn");
    const nextBtn = panel.querySelector<HTMLButtonElement>("#subtitleSearchNextBtn");
    const commitBtn = panel.querySelector<HTMLButtonElement>("#subtitleSearchCommitBtn");

    if (wordInput) {
        wordInput.value = state.query || "";
    }

    if (timeInput && Number.isFinite(state.timeSeconds)) {
        timeInput.value = formatTime(Number(state.timeSeconds));
    }

    updateSubtitleSearchPanelLabels();

    wordInput?.addEventListener("focus", () => callbacks.onWordFocus(wordInput, timeInput));
    timeInput?.addEventListener("focus", () => callbacks.onTimeFocus(wordInput, timeInput));
    wordInput?.addEventListener("input", () => callbacks.onWordInput(wordInput.value, timeInput));
    wordInput?.addEventListener("keydown", (event) => callbacks.onWordEnter(event, wordInput.value));
    timeInput?.addEventListener("input", () => callbacks.onTimeInput(timeInput.value, wordInput));
    timeInput?.addEventListener("keydown", (event) => callbacks.onTimeEnter(event));
    prevBtn?.addEventListener("click", callbacks.onPrevious);
    nextBtn?.addEventListener("click", callbacks.onNext);
    commitBtn?.addEventListener("click", callbacks.onCommit);
}

export function updateSubtitleSearchPanelLabels(): void {
    const wordInput = document.getElementById("subtitleWordSearchInput");
    const timeInput = document.getElementById("subtitleTimeSearchInput");
    const prevBtn = document.getElementById("subtitleSearchPrevBtn");
    const nextBtn = document.getElementById("subtitleSearchNextBtn");
    const commitBtn = document.getElementById("subtitleSearchCommitBtn");

    if (wordInput) {
        wordInput.setAttribute("placeholder", t("subtitleSearchWord"));
        wordInput.setAttribute("aria-label", t("subtitleSearchWord"));
    }

    if (timeInput) {
        timeInput.setAttribute("placeholder", t("subtitleSearchTime"));
        timeInput.setAttribute("aria-label", t("subtitleSearchTime"));
    }

    if (prevBtn) {
        prevBtn.setAttribute("title", t("subtitleSearchPrev"));
        prevBtn.setAttribute("aria-label", t("subtitleSearchPrev"));
    }

    if (nextBtn) {
        nextBtn.setAttribute("title", t("subtitleSearchNext"));
        nextBtn.setAttribute("aria-label", t("subtitleSearchNext"));
    }

    if (commitBtn) {
        commitBtn.setAttribute("title", t("subtitleSearchCommit"));
        commitBtn.setAttribute("aria-label", t("subtitleSearchCommit"));
    }
}
