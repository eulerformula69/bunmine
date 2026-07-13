interface SubtitleElementRef {
    index: number;
    div: HTMLElement;
    sub: RuntimeSubtitleCue;
}

interface SubtitleSearchMatch {
    subtitleIndex: number;
    start: number;
    end: number;
    [key: string]: unknown;
}

interface SubtitleContextDragState {
    kind: "back" | "forward";
    startY: number;
    currentIdx: number;
    activated: boolean;
}

interface BunmineState {
    currentLang: string;
    isResizing: boolean;
    subtitles: RuntimeSubtitleCue[];
    globalSubDelay: number;
    subtitleElements: SubtitleElementRef[];
    currentVideoFile: string | null;
    currentLibraryEpisodeId: string | number | null;
    currentLibraryVideoFileId: string | number | null;
    currentLibrarySubtitleFileId: string | number | null;
    lastClickedSubtitleIdx: number | null;
    lastSidebarWidth: string;
    lastRuntimeSubtitleText: string;
    runtimePrefetchAllRunId: number;
    runtimePrefetchAllInProgress: boolean;
    selectedKnownBasicWord: string;
    subtitleSearchQuery: string;
    subtitleSearchMatches: SubtitleSearchMatch[];
    subtitleSearchIndex: number;
    subtitleSearchMode: "word" | "time";
    subtitleSearchTimeSeconds: number | null;
    subtitleContextBackDepth: number;
    subtitleContextForwardDepth: number;
    subtitleContextDragState: SubtitleContextDragState | null;
    deckNoteRefreshTimer: ReturnType<typeof setTimeout> | null;
    runtimeHighlightPrefetchReady: boolean;
    runtimePrefetchWindowStart: number;
    runtimePrefetchWindowEnd: number;
    runtimeNextPrefetchStart: number;
    lastPrefetchSubtitleIndex: number;
}

interface Window {
    BunmineState: BunmineState;
}

window.BunmineState = {
    currentLang: "en",
    isResizing: false,
    subtitles: [],
    globalSubDelay: 0,
    subtitleElements: [],
    currentVideoFile: null,
    currentLibraryEpisodeId: null,
    currentLibraryVideoFileId: null,
    currentLibrarySubtitleFileId: null,
    lastClickedSubtitleIdx: null,
    lastSidebarWidth: "",
    lastRuntimeSubtitleText: "",
    runtimePrefetchAllRunId: 0,
    runtimePrefetchAllInProgress: false,
    selectedKnownBasicWord: "",
    subtitleSearchQuery: "",
    subtitleSearchMatches: [],
    subtitleSearchIndex: -1,
    subtitleSearchMode: "word",
    subtitleSearchTimeSeconds: null,
    subtitleContextBackDepth: 0,
    subtitleContextForwardDepth: 0,
    subtitleContextDragState: null,
    deckNoteRefreshTimer: null,
    runtimeHighlightPrefetchReady: false,
    runtimePrefetchWindowStart: -1,
    runtimePrefetchWindowEnd: -1,
    runtimeNextPrefetchStart: 0,
    lastPrefetchSubtitleIndex: -1
} satisfies BunmineState;

for (const key of Object.keys(window.BunmineState) as Array<keyof BunmineState>) {
    Object.defineProperty(window, key, {
        configurable: true,
        get() {
            return window.BunmineState[key];
        },
        set(value: BunmineState[keyof BunmineState]) {
            const state = window.BunmineState as Record<keyof BunmineState, BunmineState[keyof BunmineState]>;
            state[key] = value;
        }
    });
}
