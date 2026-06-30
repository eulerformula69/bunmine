interface SubtitleSearchPanelCallbacks {
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

interface SubtitleSearchPanelState {
    query: string;
    timeSeconds: number | null;
}

function getSubtitleSearchDict(): Record<string, string> {
    return i18n?.[currentLang]?.dict || i18n?.en?.dict || {};
}

function ensureSubtitleSearchPanel(
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

function updateSubtitleSearchPanelLabels(): void {
    const dict = getSubtitleSearchDict();

    const wordInput = document.getElementById("subtitleWordSearchInput");
    const timeInput = document.getElementById("subtitleTimeSearchInput");
    const prevBtn = document.getElementById("subtitleSearchPrevBtn");
    const nextBtn = document.getElementById("subtitleSearchNextBtn");
    const commitBtn = document.getElementById("subtitleSearchCommitBtn");

    if (wordInput) {
        wordInput.setAttribute("placeholder", dict.subtitleSearchWord || "Search word");
        wordInput.setAttribute("aria-label", dict.subtitleSearchWord || "Search word");
    }

    if (timeInput) {
        timeInput.setAttribute("placeholder", dict.subtitleSearchTime || "Time");
        timeInput.setAttribute("aria-label", dict.subtitleSearchTime || "Time");
    }

    if (prevBtn) {
        prevBtn.setAttribute("title", dict.subtitleSearchPrev || "Previous result");
        prevBtn.setAttribute("aria-label", dict.subtitleSearchPrev || "Previous result");
    }

    if (nextBtn) {
        nextBtn.setAttribute("title", dict.subtitleSearchNext || "Next result");
        nextBtn.setAttribute("aria-label", dict.subtitleSearchNext || "Next result");
    }

    if (commitBtn) {
        commitBtn.setAttribute("title", dict.subtitleSearchCommit || "Go to result");
        commitBtn.setAttribute("aria-label", dict.subtitleSearchCommit || "Go to result");
    }
}
