interface AutoAttachOptions {
    enabled(): boolean;
    snapshot(index: number): AnkiMediaSnapshot | Promise<AnkiMediaSnapshot>;
    noteIds(snapshot: AnkiMediaSnapshot): Promise<number[]>;
    verify(noteId: number, snapshot: AnkiMediaSnapshot): Promise<void>;
    update(noteId: number, snapshot: AnkiMediaSnapshot): Promise<unknown>;
    exclusive(work: () => Promise<void>): Promise<void>;
    sleep(ms: number): Promise<void>;
    now(): number;
    status(key: string, word: string): void;
    done(): void;
    error(error: unknown): void;
}

function createAutoAttachController(options: AutoAttachOptions) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let cancelled = false;
    let lastKey = "";
    async function start(word: string, index: number): Promise<void> {
        if (busy || !options.enabled()) return;
        busy = true;
        cancelled = false;
        try {
            const snapshot = await options.snapshot(index);
            snapshot.selectedWord = word;
            if (cancelled) return;
            await options.exclusive(async () => {
                options.status("toastAutoAttachPreparing", word);
                const previous = await options.noteIds(snapshot);
                if (cancelled) return;
                options.status("toastAutoAttachListening", word);
                const deadline = options.now() + 60000;
                while (!cancelled && options.now() < deadline) {
                    const noteId = findCandidateNote(previous, await options.noteIds(snapshot));
                    if (cancelled) return;
                    if (noteId) {
                        await options.verify(noteId, snapshot);
                        if (cancelled) return;
                        options.status("toastAutoAttachAdding", word);
                        await options.update(noteId, snapshot);
                        options.status("toastAutoAttachDone", word);
                        return;
                    }
                    await options.sleep(1000);
                }
                if (!cancelled) throw new Error(t("toastAutoAttachNoNewCard"));
            });
        } catch (error) {
            if (!cancelled) options.error(error);
        } finally {
            busy = false;
            options.done();
        }
    }
    return {
        start,
        isBusy: () => busy,
        arm(word: string, index: number): void {
            const key = `${index}:${word}`;
            if (!options.enabled() || !word || index < 0 || busy || key === lastKey) return;
            clearTimeout(timer);
            lastKey = key;
            timer = setTimeout(() => { void start(word, index); }, 250);
        },
        selectionCleared(): void {
            clearTimeout(timer);
            lastKey = "";
        },
        cancel(): void {
            clearTimeout(timer);
            cancelled = true;
            lastKey = "";
        },
    };
}
