
// sidebar bootstrap

function initSubtitleSidebar() {
    initSubtitleSearchPanel();
    initSubtitleSidebarToggle();
    initSubtitleSidebarResizer();
    initSubtitleContextDrag();
}

function initSubtitleSidebarToggle() {
    if (!toggleBtn || !sidebar || !resizer) return;
    if (toggleBtn.dataset.sidebarInitialized === "true") return;

    toggleBtn.dataset.sidebarInitialized = "true";

    const closeButton = document.getElementById("closeSubtitleSidebarBtn");

    const setOpen = (isOpen: boolean) => {
        if (!isOpen) {
            const currentWidth = sidebar.style.width || `${Math.round(sidebar.getBoundingClientRect().width)}px`;
            if (currentWidth && currentWidth !== "0px") lastSidebarWidth = currentWidth;

            sidebar.classList.add("hidden");
            resizer.classList.add("hidden");
            sidebar.style.width = "0px";
        } else {
            sidebar.classList.remove("hidden");
            resizer.classList.remove("hidden");

            const saved = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}").sidebarWidth;
            sidebar.style.width = lastSidebarWidth || saved || "320px";
        }

        toggleBtn.classList.toggle("active", isOpen);
        toggleBtn.setAttribute("aria-expanded", String(isOpen));
        updateSubtitleSidebarLabels();
    };

    toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(sidebar.classList.contains("hidden"));
    });

    closeButton?.addEventListener("click", () => setOpen(false));
    setOpen(!sidebar.classList.contains("hidden"));
}

function updateSubtitleSidebarLabels() {
    if (!toggleBtn || !sidebar) return;

    const dict = i18n[currentLang]?.dict || i18n.en.dict;
    const isOpen = !sidebar.classList.contains("hidden");
    const toggleLabel = dict[isOpen ? "hideSubs" : "showSubs"];
    const closeButton = document.getElementById("closeSubtitleSidebarBtn");
    const sidebarTitle = sidebar.querySelector(".subtitle-sidebar-header h2");

    toggleBtn.title = toggleLabel;
    toggleBtn.setAttribute("aria-label", toggleLabel);
    sidebar.setAttribute("aria-label", dict.subtitlesPanelTitle || "Subtitles");
    if (sidebarTitle) sidebarTitle.textContent = dict.subtitlesPanelTitle || "Subtitles";
    if (closeButton) {
        closeButton.title = dict.closeSubtitlesPanel || "Close subtitles";
        closeButton.setAttribute("aria-label", closeButton.title);
    }
}

function initSubtitleSidebarResizer() {
    if (!resizer || !sidebar) return;
    if (resizer.dataset.sidebarResizeInitialized === "true") return;

    resizer.dataset.sidebarResizeInitialized = "true";

    resizer.addEventListener("mousedown", () => {
        isResizing = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;

        const newWidth = window.innerWidth - e.clientX;

        if (newWidth > 150 && newWidth < window.innerWidth * 0.5) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener("mouseup", () => {
        if (!isResizing) return;

        isResizing = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";

        const settings = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}");
        settings.sidebarWidth = sidebar.style.width;
        localStorage.setItem("subtitlePlayerSettings", JSON.stringify(settings));
    });
}

// subtitle context

interface SubtitleContextRange {
    currentIdx: number;
    startIdx: number;
    endIdx: number;
    backDepth: number;
    forwardDepth: number;
}

interface SubtitleContextSelectionState extends SubtitleContextRange {
    items: RuntimeSubtitleCue[];
    text: string;
    startTime: number;
    endTime: number;
}

function normalizeSubtitleContextDepth(value: unknown): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return 0;

    return Math.max(0, Math.floor(numericValue));
}

function getSubtitleContextRange(currentIdx: number | null = null): SubtitleContextRange {
    const resolvedCurrentIdx = Number.isInteger(currentIdx)
        ? currentIdx
        : (
            Number.isInteger(lastClickedSubtitleIdx) &&
            lastClickedSubtitleIdx >= 0 &&
            lastClickedSubtitleIdx < subtitles.length
                ? lastClickedSubtitleIdx
                : getCurrentSubtitleIndexForNavigation()
        );

    if (!subtitles.length || resolvedCurrentIdx < 0 || resolvedCurrentIdx >= subtitles.length) {
        return {
            currentIdx: -1,
            startIdx: -1,
            endIdx: -1,
            backDepth: 0,
            forwardDepth: 0
        };
    }

    const backDepth = normalizeSubtitleContextDepth(subtitleContextBackDepth);
    const forwardDepth = normalizeSubtitleContextDepth(subtitleContextForwardDepth);

    return {
        currentIdx: resolvedCurrentIdx,
        startIdx: Math.max(0, resolvedCurrentIdx - backDepth),
        endIdx: Math.min(subtitles.length - 1, resolvedCurrentIdx + forwardDepth),
        backDepth,
        forwardDepth
    };
}

function getSubtitleContextSelection(currentIdx: number | null = null): SubtitleContextSelectionState {
    const range = getSubtitleContextRange(currentIdx);

    if (range.currentIdx < 0) {
        return {
            ...range,
            items: [],
            text: "",
            startTime: 0,
            endTime: 0
        };
    }

    const selection = buildSubtitleContextSelection(
        subtitles,
        range.currentIdx,
        range.backDepth,
        range.forwardDepth
    );
    const items = subtitles.slice(range.startIdx, range.endIdx + 1);

    return {
        ...range,
        items,
        text: selection?.text ?? "",
        startTime: selection?.startTime ?? 0,
        endTime: selection?.endTime ?? 0
    };
}

function setSubtitleContextDepths({
    backDepth = subtitleContextBackDepth,
    forwardDepth = subtitleContextForwardDepth
}: {
    backDepth?: number;
    forwardDepth?: number;
} = {}) {
    subtitleContextBackDepth = normalizeSubtitleContextDepth(backDepth);
    subtitleContextForwardDepth = normalizeSubtitleContextDepth(forwardDepth);

    if (typeof isSubtitleContextDragging === "function" && isSubtitleContextDragging()) {
        updateSubtitleContextRangePreview();
        return;
    }

	requestAnimationFrame(() => {
		restoreSubtitleFromCurrentTime();
	});
}

function updateSubtitleContextRangePreview() {
    const context = getSubtitleContextRange();

    subtitleElements.forEach(({ div, index }) => {
        const isInRange = context.currentIdx >= 0 && index >= context.startIdx && index <= context.endIdx;
        div.classList.toggle("capture-range", isInRange);
        div.classList.toggle("active", index === context.currentIdx);
    });
}

function resetSubtitleContextDepths() {
    setSubtitleContextDepths({
        backDepth: 0,
        forwardDepth: 0
    });
}

function isSubtitleContextDepthDefault() {
    return subtitleContextBackDepth === 0 && subtitleContextForwardDepth === 0;
}

// search

function initSubtitleSearchPanel() {
    ensureSubtitleSearchPanel(
        sidebar,
        {
            query: subtitleSearchQuery || "",
            timeSeconds: subtitleSearchTimeSeconds
        },
        {
            onWordFocus(wordInput, timeInput) {
                subtitleSearchMode = "word";
                subtitleSearchTimeSeconds = null;

                if (timeInput) timeInput.value = "";

                if (!wordInput.value.trim()) {
                    clearSearchMatches();
                }
            },
            onTimeFocus(wordInput, timeInput) {
                subtitleSearchMode = "time";
                subtitleSearchQuery = "";

                if (wordInput) wordInput.value = "";

                if (!timeInput.value.trim()) {
                    clearSearchMatches();
                }
            },
            onWordInput(value, timeInput) {
                subtitleSearchMode = "word";
                subtitleSearchQuery = value;
                subtitleSearchTimeSeconds = null;

                if (timeInput) timeInput.value = "";

                setSearchMatches(findSubtitleTextMatches(subtitleSearchQuery));
            },
            onWordEnter(event, value) {
                if (event.key !== "Enter") return;

                event.preventDefault();

                if (event.ctrlKey) {
                    commitSearchMatch();
                    return;
                }

                if (!subtitleSearchMatches.length) {
                    setSearchMatches(findSubtitleTextMatches(value), 0);
                    return;
                }

                goToSearchMatch(event.shiftKey ? -1 : 1);
            },
            onTimeInput(value, wordInput) {
                subtitleSearchMode = "time";
                subtitleSearchQuery = "";

                if (wordInput) wordInput.value = "";

                const seconds = parseSearchTime(value);

                if (!Number.isFinite(seconds)) {
                    subtitleSearchTimeSeconds = null;
                    clearSearchMatches();
                    return;
                }

                subtitleSearchTimeSeconds = seconds;
                setSearchMatches(buildTimeSearchMatches(seconds));
            },
            onTimeEnter(event) {
                if (event.key !== "Enter") return;

                event.preventDefault();

                if (event.ctrlKey) {
                    activateTimeSearch({ commit: true });
                    return;
                }

                activateTimeSearch({ commit: false });
            },
            onPrevious() {
                if (hasActiveSubtitleSearch()) {
                    goToSearchMatch(-1);
                    return;
                }

                goToPreviousSubtitle();
            },
            onNext() {
                if (hasActiveSubtitleSearch()) {
                    goToSearchMatch(1);
                    return;
                }

                goToNextSubtitle();
            },
            onCommit() {
                if (subtitleSearchMode === "time") {
                    activateTimeSearch({ commit: true });
                    return;
                }

                commitSearchMatch();
            }
        }
    );
}
function hasActiveSubtitleSearch() {
    return subtitleSearchMatches.length > 0;
}

function clearSearchMatches() {
    if (!subtitleSearchMatches.length && subtitleSearchIndex === -1) return;
    subtitleSearchMatches = [];
    subtitleSearchIndex = -1;

    renderSubtitles();
}

function setSearchMatches(matches: SubtitleSearchResult[], index = 0) {
    subtitleSearchMatches = Array.isArray(matches) ? matches : [];
    subtitleSearchIndex = subtitleSearchMatches.length ? index : -1;

    renderSubtitles();
    scrollToSearchMatch(getCurrentSearchMatch());
}

function findSubtitleTextMatches(query: string): SubtitleSearchResult[] {
    return findSubtitleTextMatchesInCues(
        subtitles,
        query,
        (text) => tokenizeJapaneseTextSync(text) || []
    );
}

function getSubtitleSearchHaystack(text: string): string {
    return getSubtitleSearchHaystackForText(
        text,
        (value) => tokenizeJapaneseTextSync(value) || []
    );
}

function parseSearchTime(value: string | undefined): number | null {
    return parseSubtitleSearchTime(value);
}

function findSubtitleByTime(seconds: number): number {
    return findSubtitleIndexByTime(subtitles, seconds, globalSubDelay);
}

function buildTimeSearchMatches(seconds: number): SubtitleSearchResult[] {
    return buildSubtitleTimeSearchMatches(subtitles, seconds, globalSubDelay);
}
function activateTimeSearch({ commit = false } = {}) {
    const timeInput = document.getElementById("subtitleTimeSearchInput") as HTMLInputElement | null;
    const seconds = parseSearchTime(timeInput?.value);

    if (!Number.isFinite(seconds)) return;

    subtitleSearchMode = "time";
    subtitleSearchTimeSeconds = seconds;
    subtitleSearchQuery = "";

    const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;
    if (wordInput) wordInput.value = "";

    setSearchMatches(buildTimeSearchMatches(seconds));

    if (commit) {
        commitSearchMatch();
    }
}

function getCurrentSearchMatch() {
    if (!subtitleSearchMatches.length) return null;
    if (subtitleSearchIndex < 0) return null;

    return subtitleSearchMatches[subtitleSearchIndex] || null;
}

function scrollToSearchMatch(match) {
    if (!match) return;

    const el = sidebar.querySelector(
        `.subtitle[data-index="${match.subtitleIndex}"]`
    );

    if (!el) return;

    el.scrollIntoView({
        block: "center",
        behavior: "smooth"
    });
}

function goToSearchMatch(direction = 1) {
    if (!subtitleSearchMatches.length) {
        if (subtitleSearchMode === "word") {
            const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;
            subtitleSearchQuery = wordInput?.value || "";
            subtitleSearchMatches = findSubtitleTextMatches(subtitleSearchQuery);
        }

        if (subtitleSearchMode === "time") {
            const timeInput = document.getElementById("subtitleTimeSearchInput") as HTMLInputElement | null;
            const seconds = parseSearchTime(timeInput?.value);

            if (Number.isFinite(seconds)) {
                subtitleSearchTimeSeconds = seconds;
                subtitleSearchMatches = buildTimeSearchMatches(seconds);
            }
        }

        subtitleSearchIndex = subtitleSearchMatches.length ? 0 : -1;
    }

    if (!subtitleSearchMatches.length) return;

    subtitleSearchIndex += direction;

    if (subtitleSearchIndex >= subtitleSearchMatches.length) {
        subtitleSearchIndex = 0;
    }

    if (subtitleSearchIndex < 0) {
        subtitleSearchIndex = subtitleSearchMatches.length - 1;
    }

    const match = getCurrentSearchMatch();

    renderSubtitles();
    scrollToSearchMatch(match);
}

function commitSearchMatch() {
    const match = getCurrentSearchMatch();

    if (!match) return;

    const sub = subtitles[match.subtitleIndex];

    if (!sub) return;

    if (match.type === "time" && Number.isFinite(match.seconds)) {
        video.currentTime = match.seconds;
    } else {
        video.currentTime = sub.start + globalSubDelay;
    }

    video.pause();
    syncSubtitleStyle(match.subtitleIndex);

    subtitleSearchMatches = [];
    subtitleSearchIndex = -1;
    renderSubtitles();
}

// navigation

function seekBySubtitle(offset: number) {
    if (!subtitles.length) return;

    clearSearchMatches();

    const currentIdx = findSubtitleIndexForOffset(subtitles, video.currentTime, offset);

    const targetSub = subtitles[currentIdx];

    video.pause();
    video.currentTime = targetSub.start + 0.05;

    renderSubtitleOverlay({
        overlay,
        text: targetSub.text,
        highlighter: ankiSubtitleHighlighter
    });

    syncSubtitleStyle(currentIdx);
}

function syncSubtitleStyle(idx: number) {
    lastClickedSubtitleIdx = idx;

    renderSubtitles();

    subtitleElements[idx]?.div.scrollIntoView({ behavior: "smooth", block: "center" });
}

function restoreSubtitleFromCurrentTime() {
    const idx = findSubtitleIndexForPlaybackTime(subtitles, video.currentTime, globalSubDelay);

    if (idx === -1) return;

    syncSubtitleStyle(idx);
}
