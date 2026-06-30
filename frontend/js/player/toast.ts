interface ToastAction {
    label: string;
    onClick: () => void | Promise<void>;
}

function formatToastMessage(template: string, params: Record<string, unknown> = {}): string {
    return Object.entries(params).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
        template
    );
}

function showTranslatedToast(
    key: string,
    params: Record<string, unknown> = {},
    type: ToastType = "info",
    duration = 3000
): void {
    showToast(t(key, params), type, duration);
}

// TODO: Move auto-attach action toast lifecycle here after the queue state leaves player/app.js.
function showPersistentActionToast(message: string, actions: ToastAction[], type: ToastType = "info"): void {
    showActionToast(message, actions, type, 0);
}
