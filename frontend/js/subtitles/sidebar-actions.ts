function getCurrentSubtitleIndexForNavigation(): number {
    const primaryIndex = getPrimarySubtitleIndex();
    if (primaryIndex !== -1) return primaryIndex;
    const adjustedTime = video.currentTime - globalSubDelay;

    const nextIndex = subtitles.findIndex((cue) => cue.start > adjustedTime);
    if (nextIndex !== -1) return nextIndex;

    return subtitles.length - 1;
}

function goToPreviousSubtitle(): void {
    if (!subtitles.length) return;

    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const referenceTime = subtitles[currentIndex]?.start ?? (video.currentTime - globalSubDelay);
    const targetIndex = findSubtitleIndexForOffset(subtitles, referenceTime, -1);

    video.currentTime = Math.max(0, subtitles[targetIndex].start + globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
}

function goToNextSubtitle(): void {
    if (!subtitles.length) return;

    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const referenceTime = subtitles[currentIndex]?.start ?? (video.currentTime - globalSubDelay);
    const targetIndex = findSubtitleIndexForOffset(subtitles, referenceTime, 1);

    video.currentTime = Math.max(0, subtitles[targetIndex].start + globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
}

function replayCurrentSubtitle(): void {
    if (!subtitles.length) return;

    clearSearchMatches();

    const currentIndex = getPrimarySubtitleIndex() !== -1
        ? getPrimarySubtitleIndex()
        : getCurrentSubtitleIndexForNavigation();
    const targetSub = subtitles[currentIndex];

    if (!targetSub) return;

    video.currentTime = Math.max(0, targetSub.start + globalSubDelay + 0.01);

    renderSubtitleOverlay({
        overlay,
        text: targetSub.text,
        highlighter: ankiSubtitleHighlighter
    });

    syncSubtitleStyle(currentIndex);
    video.play();
}

function focusSubtitleWordSearch(): void {
    if (sidebar?.classList.contains("hidden")) {
        toggleBtn?.click();
    }

    requestAnimationFrame(() => {
        const wordInput = document.getElementById("subtitleWordSearchInput") as HTMLInputElement | null;

        wordInput?.focus();
        wordInput?.select();
    });
}

function updateSubtitleSearchPanelLanguage(): void {
    updateSubtitleSearchPanelLabels();
}
