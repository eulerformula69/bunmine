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

interface PlayerHotkeyActions {
    seekBySeconds: (seconds: number) => void;
    seekBySubtitle: (direction: number) => void;
    toggleFullscreen: () => void;
    stepFrame: (direction: number) => void;
    togglePlayback: () => void;
    replaySubtitle: () => void;
    focusSearch: () => void;
    toggleSubtitles: () => void;
}

function bindPlayerHotkeys(actions: PlayerHotkeyActions): void {
    document.addEventListener("keydown", (event) => {
        if (!shouldHandlePlayerHotkey(event)) return;

        const command = event.code;
        if (command === "ArrowLeft" || command === "ArrowRight") {
            event.preventDefault();
            const direction = command === "ArrowLeft" ? -1 : 1;
            if (event.shiftKey) actions.seekBySeconds(direction * 5);
            else actions.seekBySubtitle(direction);
            return;
        }

        const handlers: Record<string, () => void> = {
            KeyF: actions.toggleFullscreen,
            Comma: () => actions.stepFrame(-1),
            Period: () => actions.stepFrame(1),
            Space: actions.togglePlayback,
            KeyR: actions.replaySubtitle,
            Slash: actions.focusSearch,
            KeyS: actions.toggleSubtitles,
        };
        const handler = handlers[command];
        if (!handler) return;
        event.preventDefault();
        handler();
    });
}
