import { ToastType } from "../types/runtime-types.js";
import { showActionToast, showToast, t } from "./ui.js";
export interface ToastAction {
    label: string;
    onClick: () => void | Promise<void>;
}

export function formatToastMessage(template: string, params: Record<string, unknown> = {}): string {
    return Object.entries(params).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
        template
    );
}

export function showTranslatedToast(
    key: string,
    params: Record<string, unknown> = {},
    type: ToastType = "info",
    duration = 3000
): void {
    showToast(t(key, params), type, duration);
}

// TODO: Move auto-attach action toast lifecycle here after the queue state leaves player/app.js.
export function showPersistentActionToast(message: string, actions: ToastAction[], type: ToastType = "info"): void {
    showActionToast(message, actions, type, 0);
}
