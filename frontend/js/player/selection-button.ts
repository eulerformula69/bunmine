export function bindSelectionButtonAction(
    button: HTMLButtonElement | null,
    action: () => void | Promise<void>,
): void {
    if (!button) return;

    let pointerActionHandled = false;

    button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        pointerActionHandled = true;
        void action();
    });

    button.addEventListener("pointerup", () => {
        window.setTimeout(() => {
            pointerActionHandled = false;
        }, 0);
    });

    button.addEventListener("pointercancel", () => {
        pointerActionHandled = false;
    });

    button.addEventListener("mousedown", (event) => {
        event.preventDefault();
    });

    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (pointerActionHandled) {
            pointerActionHandled = false;
            return;
        }

        void action();
    });
}
