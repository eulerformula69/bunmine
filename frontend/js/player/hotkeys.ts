function isEditableHotkeyTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable
    );
}

function shouldHandlePlayerHotkey(event: KeyboardEvent): boolean {
    return !event.defaultPrevented && !isEditableHotkeyTarget(event.target);
}

// TODO: Move concrete key bindings after player controls are accessed through PlayerContext only.
