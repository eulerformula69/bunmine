let ankiAcquireRunning = false;

async function runExclusiveAnkiAcquire<T>(work: () => Promise<T>): Promise<T> {
    if (ankiAcquireRunning) throw new Error(t("ankiAcquireBusy"));
    ankiAcquireRunning = true;
    try {
        if (navigator.locks) {
            return await navigator.locks.request("bunmine-anki-acquire", { ifAvailable: true }, async (lock) => {
                if (!lock) throw new Error(t("ankiAcquireBusy"));
                return work();
            });
        }
        return await work();
    } finally {
        ankiAcquireRunning = false;
    }
}
