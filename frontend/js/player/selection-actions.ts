addKnownBasicBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
});

addKnownBasicBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await addWordToKnownBasic(selectedKnownBasicWord);
});

addCardToDeck?.addEventListener("mousedown", (event) => event.preventDefault());
addCardToDeck?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void captureSelectedCandidate();
});

document.addEventListener("keydown", (event) => {
    if (!candidateCaptureHotkey(event) || isEditableHotkeyTarget(event.target)) return;
    event.preventDefault();
    void captureSelectedCandidate();
});

document.addEventListener("mousedown", (e) => {
    if (
        addKnownBasicBtn?.contains(e.target as Node) ||
        addCardToDeck?.contains(e.target as Node)
    ) {
        return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
        hideAddKnownBasicButton();
    }
});

document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hideAddKnownBasicButton();
        return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode;

    const focusElement = focusNode?.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : focusNode;

    const isSubtitleSelection =
        overlay?.contains(anchorElement) ||
        overlay?.contains(focusElement) || getSubtitleIndexFromSelection(selection) >= 0;

    if (!isSubtitleSelection) {
        hideAddKnownBasicButton();
        return;
    }


    requestAnimationFrame(() => {
        showAddKnownBasicButtonForSelection();
    });
});
