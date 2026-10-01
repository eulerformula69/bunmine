import { addCardToDeck,addKnownBasicBtn,overlay } from "../core/dom.js";

import { addWordToKnownBasic } from "./controllers.js";

import { state } from "../core/state.js";

import { captureSelectedCandidate } from "./candidate-bindings.js";

import { candidateCaptureHotkey } from "./candidate-model.js";

import { isEditableHotkeyTarget } from "./hotkeys.js";

import { getCleanSelectedText,hideAddKnownBasicButton,showAddKnownBasicButtonForSelection } from "./ui.js";

import { autoAttachController } from "./auto-attach-bindings.js";

import { getSubtitleIndexFromSelection } from "./selection-model.js";

addKnownBasicBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
});

addKnownBasicBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await addWordToKnownBasic(state.selectedKnownBasicWord);
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
        autoAttachController.selectionCleared();
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
        autoAttachController.selectionCleared();
        hideAddKnownBasicButton();
        return;
    }


    requestAnimationFrame(() => {
        showAddKnownBasicButtonForSelection();
        autoAttachController.arm(getCleanSelectedText(), getSubtitleIndexFromSelection());
    });
});
