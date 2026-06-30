
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

    toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        const isHidden = sidebar.classList.contains("hidden");

        if (!isHidden) {
            const currentWidth = sidebar.style.width || `${Math.round(sidebar.getBoundingClientRect().width)}px`;
            if (currentWidth && currentWidth !== "0px") lastSidebarWidth = currentWidth;

            sidebar.classList.add("hidden");
            resizer.classList.add("hidden");
            sidebar.style.width = "0px";
        } else {
            sidebar.classList.remove("hidden");
            resizer.classList.remove("hidden");

            const saved = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}").sidebarWidth;
            sidebar.style.width = lastSidebarWidth || saved || "260px";
        }

        const langKey = sidebar.classList.contains("hidden") ? "showSubs" : "hideSubs";
        toggleBtn.textContent = i18n[currentLang].dict[langKey];
    });
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

function normalizeSubtitleContextDepth(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return 0;

    return Math.max(0, Math.floor(numericValue));
}

function getSubtitleContextRange(currentIdx = null) {
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

function getSubtitleContextSelection(currentIdx = null) {
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
} = {}) {
    subtitleContextBackDepth = normalizeSubtitleContextDepth(backDepth);
    subtitleContextForwardDepth = normalizeSubtitleContextDepth(forwardDepth);

	requestAnimationFrame(() => {
		restoreSubtitleFromCurrentTime();
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
    subtitleSearchMatches = [];
    subtitleSearchIndex = -1;

    renderSubtitles();
}

function setSearchMatches(matches, index = 0) {
    subtitleSearchMatches = Array.isArray(matches) ? matches : [];
    subtitleSearchIndex = subtitleSearchMatches.length ? index : -1;

    renderSubtitles();
    scrollToSearchMatch(getCurrentSearchMatch());
}

function findSubtitleTextMatches(query) {
    return findSubtitleTextMatchesInCues(
        subtitles,
        query,
        (text) => tokenizeJapaneseTextSync(text) || []
    );
}

function getSubtitleSearchHaystack(text) {
    return getSubtitleSearchHaystackForText(
        text,
        (value) => tokenizeJapaneseTextSync(value) || []
    );
}

function parseSearchTime(value) {
    return parseSubtitleSearchTime(value);
}

function findSubtitleByTime(seconds) {
    return findSubtitleIndexByTime(subtitles, seconds, globalSubDelay);
}

function buildTimeSearchMatches(seconds) {
    return buildSubtitleTimeSearchMatches(subtitles, seconds, globalSubDelay);
}
function activateTimeSearch({ commit = false } = {}) {
    const timeInput = document.getElementById("subtitleTimeSearchInput");
    const seconds = parseSearchTime(timeInput?.value);

    if (!Number.isFinite(seconds)) return;

    subtitleSearchMode = "time";
    subtitleSearchTimeSeconds = seconds;
    subtitleSearchQuery = "";

    const wordInput = document.getElementById("subtitleWordSearchInput");
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
            const wordInput = document.getElementById("subtitleWordSearchInput");
            subtitleSearchQuery = wordInput?.value || "";
            subtitleSearchMatches = findSubtitleTextMatches(subtitleSearchQuery);
        }

        if (subtitleSearchMode === "time") {
            const timeInput = document.getElementById("subtitleTimeSearchInput");
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

// rendering

function initSubtitleContextDrag() {
    if (document.body.dataset.subtitleContextDragInitialized === "true") return;

    document.body.dataset.subtitleContextDragInitialized = "true";

    document.addEventListener("mousemove", onSubtitleContextDragMove);
    document.addEventListener("mouseup", stopSubtitleContextDrag);
}

function startSubtitleContextDrag(kind, event) {
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

function onSubtitleContextDragMove(event) {
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

function updateSubtitleContextDepthFromPointer(kind, clientY, currentIdx) {
    if (!subtitleElements.length) return;

    const allowedElements = subtitleElements.filter(({ index }) => {
        return kind === "back"
            ? index <= currentIdx
            : index >= currentIdx;
    });

    if (!allowedElements.length) return;

    let nearestIndex = allowedElements[0].index;
    let nearestDistance = Infinity;

    allowedElements.forEach(({ div, index }) => {
        const rect = div.getBoundingClientRect();
        const centerY = rect.top + (rect.height / 2);
        const distance = Math.abs(centerY - clientY);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    if (kind === "back") {
        setSubtitleContextDepths({
            backDepth: Math.max(0, currentIdx - nearestIndex),
            forwardDepth: subtitleContextForwardDepth
        });
        return;
    }

    setSubtitleContextDepths({
        backDepth: subtitleContextBackDepth,
        forwardDepth: Math.max(0, nearestIndex - currentIdx)
    });
}

function renderSubtitles() {
    initSubtitleSearchPanel();

    const list = document.getElementById("subtitleList");
    if (!list) return;

    list.innerHTML = "";
    subtitleElements = [];

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

        div.onclick = () => {
            clearSearchMatches();

            if (lastClickedSubtitleIdx === idx) {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                    video.currentTime = sub.start + globalSubDelay + 0.05;
                }
				} else {
					video.pause();
					syncSubtitleStyle(idx);
					video.currentTime = sub.start + globalSubDelay + 0.05;

					renderSubtitleOverlay({
						overlay,
						text: sub.text,
						highlighter: ankiSubtitleHighlighter
					});
				}

            updatePlayButton();
        };

		if (context.currentIdx >= 0 && idx === context.startIdx) {
			div.appendChild(createSubtitleDepthHandleElement("back", startSubtitleContextDrag));
		}

		if (context.currentIdx >= 0 && idx === context.endIdx) {
			div.appendChild(createSubtitleDepthHandleElement("forward", startSubtitleContextDrag));
		}

		list.appendChild(div);
		subtitleElements.push({ index: idx, div, sub });
    });
}

// navigation

function seekBySubtitle(offset) {
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

function syncSubtitleStyle(idx) {
    lastClickedSubtitleIdx = idx;

    renderSubtitles();

    subtitleElements.forEach(({ div, index }) => {
        if (index === idx) {
            div.classList.add("active");
            div.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
            div.classList.remove("active");
        }
    });
}

function restoreSubtitleFromCurrentTime() {
    const idx = findSubtitleIndexForPlaybackTime(subtitles, video.currentTime, globalSubDelay);

    if (idx === -1) return;

    syncSubtitleStyle(idx);
}
