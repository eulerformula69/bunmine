interface AutoAttachSnapshot {
    ankiUrl: string;
    deckName: string;
    selectedWord?: string;
    [key: string]: any;
}

interface AutoAttachTask {
    id: number;
    selectedWord: string;
    copyWord: boolean;
    subtitleIndex: number | null;
    armKey: string;
    cancelled: boolean;
    snapshot: AutoAttachSnapshot | null;
    previousNoteIds: Array<number | string>;
    position?: number;
}

interface AutoAttachQueueOptions {
    translate(key: string, params?: Record<string, unknown>): string;
    getSelectedText(): string;
    buildSnapshot(options: { subtitleIndex: number | null }): AutoAttachSnapshot;
    fetchDeckNoteIds(ankiUrl: string, deckName: string): Promise<number[]>;
    fetchNoteIdsByQuery(ankiUrl: string, query: string, context: string): Promise<number[]>;
    fetchNotesInfo(ankiUrl: string, noteIds: number[]): Promise<any[]>;
    stripHtml(value: unknown): string;
    sleep(milliseconds: number): Promise<void>;
    copyWord(word: string): Promise<void>;
    updateNote(noteId: number, snapshot: AutoAttachSnapshot): Promise<unknown>;
    refreshTargetNotes(): void;
    maybePromptSubtitleDepthReset(): void;
    showToast(message: string, type?: string, duration?: number): unknown;
    showActionToast(
        message: string,
        actions: Array<{ label: string; onClick?: () => void }>,
        type?: string,
        duration?: number
    ): HTMLElement;
    isEnabled(): boolean;
}

interface AutoAttachQueueController {
    start(word: string, options?: { copyWord?: boolean; subtitleIndex?: number | null; armKey?: string }): Promise<void>;
    armForSelection(word: string, subtitleIndex: number): void;
    scheduleCancelIfSelectionCleared(): void;
    clearSelectionCancelTimer(): void;
}

class AutoAttachCancelledError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AutoAttachCancelledError";
    }
}

function createAutoAttachQueueController(options: AutoAttachQueueOptions): AutoAttachQueueController {
    let queue: AutoAttachTask[] = [];
    let activeTask: AutoAttachTask | null = null;
    let nextTaskId = 0;
    let statusToast: HTMLElement | null = null;
    let armTimer: ReturnType<typeof setTimeout> | null = null;
    let selectionClearTimer: ReturnType<typeof setTimeout> | null = null;
    let processing = false;
    const queuedKeys = new Set<string>();

    const translate = options.translate;

    function getQueueSize(): number {
        return queue.length + (activeTask ? 1 : 0);
    }

    function isBusy(): boolean {
        return getQueueSize() > 0;
    }

    function closeStatusToast(): void {
        if (!statusToast) return;

        statusToast.classList.add("mp-toast-removing");
        const toast = statusToast;
        statusToast = null;
        setTimeout(() => toast.remove(), 180);
    }

    function cancel(): void {
        if (activeTask) activeTask.cancelled = true;
        queue.forEach((task) => task.cancelled = true);
        queue = [];
        queuedKeys.clear();
        closeStatusToast();
        clearSelectionCancelTimer();
    }

    function setStatus(message: string, type = "info", persistent = true): void {
        if (!statusToast || !document.body.contains(statusToast)) {
            statusToast = options.showActionToast(
                message,
                [{ label: translate("toastAutoAttachCancel"), onClick: cancel }],
                type,
                persistent ? 0 : 3500
            );
            return;
        }

        const messageElement = statusToast.querySelector(".mp-toast-action-message");
        if (messageElement) messageElement.textContent = message;
        statusToast.className = `mp-toast mp-toast-${type} mp-toast-action`;
    }

    function formatQueueStatus(key: string, task: AutoAttachTask, type = "info"): void {
        setStatus(translate(key, {
            word: task.selectedWord,
            count: getQueueSize(),
            position: task.position || 1
        }), type);
    }

    async function waitForNextNote(
        snapshot: AutoAttachSnapshot,
        previousNoteIds: Array<number | string>,
        task: AutoAttachTask
    ): Promise<number> {
        const previous = new Set(previousNoteIds.map((id) => String(id)));
        const deadline = Date.now() + 60000;

        while (Date.now() < deadline) {
            if (task.cancelled) {
                throw new AutoAttachCancelledError(translate("toastAutoAttachCancelled"));
            }

            const noteIds = await options.fetchDeckNoteIds(snapshot.ankiUrl, snapshot.deckName);
            const recentIds = await options.fetchNoteIdsByQuery(
                snapshot.ankiUrl,
                "added:1",
                "AnkiConnect find recent notes"
            );
            const newIds = [...new Set([...noteIds, ...recentIds])]
                .filter((id) => !previous.has(String(id)))
                .sort((a, b) => Number(a) - Number(b));

            if (newIds.length) {
                const infoList = await options.fetchNotesInfo(snapshot.ankiUrl, newIds.slice(-10));
                const selectedWord = options.stripHtml(snapshot.selectedWord).toLowerCase();

                if (selectedWord) {
                    const matchingNote = infoList.find((note) => Object.values(note?.fields || {}).some(
                        (field: any) => options.stripHtml(field?.value).toLowerCase().includes(selectedWord)
                    ));
                    if (matchingNote?.noteId) return Number(matchingNote.noteId);
                }

                return Number(infoList[0]?.noteId || newIds[0]);
            }

            await options.sleep(1000);
        }

        throw new Error(translate("toastAutoAttachNoNewCard"));
    }

    async function prepareTask(
        word: string,
        { copyWord = false, subtitleIndex = null, armKey = "" } = {}
    ): Promise<AutoAttachTask | null> {
        const selectedWord = String(word || options.getSelectedText() || "").trim();

        if (!selectedWord) {
            options.showToast(translate("toastNoWordSelected"), "error", 3000);
            return null;
        }

        const task: AutoAttachTask = {
            id: ++nextTaskId,
            selectedWord,
            copyWord,
            subtitleIndex,
            armKey,
            cancelled: false,
            snapshot: null,
            previousNoteIds: []
        };

        setStatus(translate("toastAutoAttachPreparing", { word: selectedWord }));

        try {
            const snapshot = options.buildSnapshot({ subtitleIndex });
            snapshot.selectedWord = selectedWord;
            task.snapshot = snapshot;
            setStatus(translate("toastAutoAttachSnapshotReady", { word: selectedWord }));

            const deckNoteIds = await options.fetchDeckNoteIds(snapshot.ankiUrl, snapshot.deckName);
            const recentNoteIds = await options.fetchNoteIdsByQuery(
                snapshot.ankiUrl,
                "added:1",
                "AnkiConnect find recent notes"
            );
            task.previousNoteIds = [...new Set([...deckNoteIds, ...recentNoteIds])];
        } catch (error) {
            closeStatusToast();
            if (armKey) queuedKeys.delete(armKey);
            const message = error instanceof Error ? error.message : String(error);
            options.showToast(translate("toastError", { message }), "error", 6000);
            return null;
        }

        return task;
    }

    function markNoteConsumed(noteId: number): void {
        const consumedId = String(noteId);
        queue.forEach((task) => {
            const previous = new Set(task.previousNoteIds.map((id) => String(id)));
            previous.add(consumedId);
            task.previousNoteIds = [...previous];
        });
    }

    async function processQueue(): Promise<void> {
        if (processing) return;
        processing = true;

        try {
            while (queue.length) {
                const task = queue.shift()!;
                activeTask = task;
                task.position = 1;

                try {
                    if (task.copyWord) await options.copyWord(task.selectedWord);

                    formatQueueStatus("toastAutoAttachListeningQueued", task);
                    const targetNoteId = await waitForNextNote(task.snapshot!, task.previousNoteIds, task);
                    formatQueueStatus("toastAutoAttachAddingQueued", task);
                    markNoteConsumed(targetNoteId);
                    await options.updateNote(targetNoteId, task.snapshot!);

                    options.showToast(translate("toastAutoAttachDoneQueued", {
                        word: task.selectedWord,
                        count: queue.length
                    }), "success", 5000);
                    options.refreshTargetNotes();
                    options.maybePromptSubtitleDepthReset();
                } catch (error) {
                    if (error instanceof AutoAttachCancelledError) return;

                    console.warn("Auto attach next Anki card failed:", error);
                    const message = error instanceof Error ? error.message : String(error);
                    options.showToast(translate("toastAutoAttachFailed", { message }), "error", 7000);
                } finally {
                    if (task.armKey) queuedKeys.delete(task.armKey);
                    activeTask = null;
                    clearSelectionCancelTimer();
                }
            }
        } finally {
            processing = false;
            if (!isBusy()) closeStatusToast();
        }
    }

    async function start(
        word: string,
        { copyWord = false, subtitleIndex = null, armKey = "" } = {}
    ): Promise<void> {
        const task = await prepareTask(word, { copyWord, subtitleIndex, armKey });
        if (!task) return;

        queue.push(task);
        formatQueueStatus("toastAutoAttachQueued", task);
        void processQueue();
    }

    function armForSelection(word: string, subtitleIndex: number): void {
        if (!options.isEnabled()) return;

        const armKey = `${subtitleIndex}:${word}`;
        if (queuedKeys.has(armKey)) return;

        if (armTimer) clearTimeout(armTimer);
        armTimer = setTimeout(() => {
            if (!options.isEnabled() || queuedKeys.has(armKey)) return;

            queuedKeys.add(armKey);
            void start(word, { copyWord: false, subtitleIndex, armKey });
        }, 250);
    }

    function scheduleCancelIfSelectionCleared(): void {
        clearSelectionCancelTimer();
        if (!isBusy()) return;

        selectionClearTimer = setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection && !selection.isCollapsed
                ? selection.toString().trim()
                : "";
            if (!selectedText) cancel();
        }, 1200);
    }

    function clearSelectionCancelTimer(): void {
        if (selectionClearTimer) clearTimeout(selectionClearTimer);
        selectionClearTimer = null;
    }

    return {
        start,
        armForSelection,
        scheduleCancelIfSelectionCleared,
        clearSelectionCancelTimer
    };
}
