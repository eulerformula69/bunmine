import { overlay } from "../core/dom.js";

import { getPrimarySubtitleIndex } from "../subtitles/timing.js";

export function getSubtitleIndexFromSelection(selection = window.getSelection()) {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return -1;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode as Element | null;
    const focusElement = focusNode?.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : focusNode as Element | null;

    const sidebarSubtitle = anchorElement?.closest?.(".subtitle[data-index]")
        || focusElement?.closest?.(".subtitle[data-index]");

    if (sidebarSubtitle) {
        const idx = Number((sidebarSubtitle as HTMLElement).dataset.index);
        return Number.isInteger(idx) ? idx : -1;
    }

    if (overlay?.contains(anchorElement) || overlay?.contains(focusElement)) {
        const overlaySubtitle = anchorElement?.closest?.(".subtitle-overlay-line[data-subtitle-index]")
            || focusElement?.closest?.(".subtitle-overlay-line[data-subtitle-index]");
        const index = Number((overlaySubtitle as HTMLElement | null)?.dataset.subtitleIndex);
        return Number.isInteger(index) ? index : getPrimarySubtitleIndex();
    }

    return -1;
}
