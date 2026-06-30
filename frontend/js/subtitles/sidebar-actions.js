function getCurrentSubtitleIndexForNavigation() {
    const adjustedTime = video.currentTime - globalSubDelay;
    const activeIndex = subtitles.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);
    if (activeIndex !== -1)
        return activeIndex;
    const nextIndex = subtitles.findIndex((cue) => cue.start > adjustedTime);
    if (nextIndex !== -1)
        return nextIndex;
    return subtitles.length - 1;
}
function goToPreviousSubtitle() {
    if (!subtitles.length)
        return;
    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const targetIndex = Math.max(0, currentIndex - 1);
    video.currentTime = Math.max(0, subtitles[targetIndex].start + globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
    audioManager?.sync?.();
}
function goToNextSubtitle() {
    if (!subtitles.length)
        return;
    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const targetIndex = Math.min(subtitles.length - 1, currentIndex + 1);
    video.currentTime = Math.max(0, subtitles[targetIndex].start + globalSubDelay + 0.01);
    syncSubtitleStyle(targetIndex);
    audioManager?.sync?.();
}
function replayCurrentSubtitle() {
    if (!subtitles.length)
        return;
    clearSearchMatches();
    const currentIndex = getCurrentSubtitleIndexForNavigation();
    const targetSub = subtitles[currentIndex];
    if (!targetSub)
        return;
    video.currentTime = Math.max(0, targetSub.start + globalSubDelay + 0.01);
    renderSubtitleOverlay({
        overlay,
        text: targetSub.text,
        highlighter: ankiSubtitleHighlighter
    });
    syncSubtitleStyle(currentIndex);
    audioManager?.sync?.();
    video.play();
}
function focusSubtitleWordSearch() {
    if (sidebar?.classList.contains("hidden")) {
        toggleBtn?.click();
    }
    requestAnimationFrame(() => {
        const wordInput = document.getElementById("subtitleWordSearchInput");
        wordInput?.focus();
        wordInput?.select();
    });
}
function updateSubtitleSearchPanelLanguage() {
    updateSubtitleSearchPanelLabels();
}
