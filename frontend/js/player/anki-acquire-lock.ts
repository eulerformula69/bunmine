import { t } from "../core/translate.js";

export const ankiAcquireRunningState = { value: false };

export async function runExclusiveAnkiAcquire<T>(work: () => Promise<T>): Promise<T> {
    if (ankiAcquireRunningState.value) throw new Error(t("ankiAcquireBusy"));
    ankiAcquireRunningState.value = true;
    try {
        if (navigator.locks) {
            return await navigator.locks.request("bunmine-anki-acquire", { ifAvailable: true }, async (lock) => {
                if (!lock) throw new Error(t("ankiAcquireBusy"));
                return work();
            });
        }
        return await work();
    } finally {
        ankiAcquireRunningState.value = false;
    }
}
