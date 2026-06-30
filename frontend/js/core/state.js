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
};
for (const key of Object.keys(window.BunmineState)) {
    Object.defineProperty(window, key, {
        configurable: true,
        get() {
            return window.BunmineState[key];
        },
        set(value) {
            const state = window.BunmineState;
            state[key] = value;
        }
    });
}
