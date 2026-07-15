interface RuntimePrefetchOptions {
    state: BunmineState;
    getSubtitles: () => RuntimeSubtitleCue[];
    getCurrentSubtitle: () => RuntimeSubtitleCue | null | undefined;
    loadWordIndexes: () => Promise<unknown>;
    loadTokenizer: () => Promise<unknown>;
    collectCandidates: (text: string) => string[];
    hasStatus: (candidate: string) => boolean;
    ensureStatuses: (candidates: string[], options: { silent: boolean }) => Promise<unknown>;
    rerender: () => void;
    delay?: (milliseconds: number) => Promise<void>;
}

function createRuntimePrefetchController(options: RuntimePrefetchOptions) {
    const delay = options.delay || ((milliseconds) => new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
    }));

    async function prefetch({ silent: _silent = true, startIndex = null }: {
        silent?: boolean;
        startIndex?: number | null;
    } = {}): Promise<void> {
        const subtitles = options.getSubtitles();
        const state = options.state;
        if (!subtitles.length || state.runtimePrefetchAllInProgress) return;

        const runId = ++state.runtimePrefetchAllRunId;
        state.runtimePrefetchAllInProgress = true;
        state.runtimeHighlightPrefetchReady = false;

        try {
            await options.loadWordIndexes();
            await options.loadTokenizer();

            let currentIndex = Number.isInteger(startIndex)
                ? Number(startIndex)
                : subtitles.indexOf(options.getCurrentSubtitle() as RuntimeSubtitleCue);
            if (currentIndex < 0) currentIndex = 0;

            const start = Math.max(0, currentIndex);
            const end = Math.min(subtitles.length - 1, start + 19);
            state.runtimePrefetchWindowStart = start;
            state.runtimePrefetchWindowEnd = end;
            state.runtimeNextPrefetchStart = end + 1;

            const candidates = new Set<string>();
            for (const subtitle of subtitles.slice(start, end + 1)) {
                if (runId !== state.runtimePrefetchAllRunId) return;
                if (!subtitle?.text) continue;
                for (const candidate of options.collectCandidates(subtitle.text)) {
                    if (!options.hasStatus(candidate)) candidates.add(candidate);
                }
            }

            const pending = [...candidates];
            for (let index = 0; index < pending.length; index += 100) {
                if (runId !== state.runtimePrefetchAllRunId) return;
                await options.ensureStatuses(pending.slice(index, index + 100), { silent: true });
                await delay(50);
            }

            if (runId === state.runtimePrefetchAllRunId) {
                state.runtimeHighlightPrefetchReady = true;
                options.rerender();
            }
        } catch (error) {
            console.warn("Runtime batch prefetch failed:", error);
        } finally {
            if (runId === state.runtimePrefetchAllRunId) {
                state.runtimePrefetchAllInProgress = false;
            }
        }
    }

    return { prefetch };
}
