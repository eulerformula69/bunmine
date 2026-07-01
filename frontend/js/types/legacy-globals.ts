type ToastType = "info" | "success" | "error" | "warning" | string;

interface VideoFilePayload {
    filename: string;
}

interface LibraryVideoFilePayload {
    videoFileId: string | number;
}

type CurrentVideoPayload = VideoFilePayload | LibraryVideoFilePayload;

interface AudioTrackInfo {
    index: string | number;
    tags?: {
        language?: string;
        title?: string;
    };
}

interface AudioTracksResponse extends ApiPayload {
    tracks?: AudioTrackInfo[];
}

interface TrackUrlResponse extends ApiPayload {
    url?: string;
}

interface LibraryPlaybackPayload extends ApiPayload {
    episodeId?: string | number | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
    videoUrl: string;
    subtitleUrl?: string | null;
    currentTimeSeconds?: number | null;
    seriesTitle?: string;
    episodeTitle?: string;
}

interface LibraryProgressPayload extends ApiPayload {
    progress?: {
        completed?: boolean;
        duration_seconds?: number;
        current_time_seconds?: number;
        watched_seconds?: number;
    };
}

interface Window {
    kuromoji?: {
        builder(options: { dicPath: string }): {
            build(callback: (err: Error | null, tokenizer: JapaneseTokenizer) => void): void;
        };
    };
}

interface JapaneseTokenizer {
    tokenize(text: string): JapaneseToken[];
}

interface JapaneseToken {
    surface_form?: string;
    basic_form?: string;
    reading?: string;
    pos?: string;
    word_position?: number;
    [key: string]: unknown;
}

declare let currentLang: string;
declare let subtitles: SubtitleCue[];
declare let globalSubDelay: number;
declare let lastRuntimeSubtitleText: string;
declare let runtimePrefetchAllRunId: number;
declare let runtimeHighlightPrefetchReady: boolean;
declare let currentVideoFile: string | null;
declare let currentLibraryEpisodeId: string | number | null;
declare let currentLibraryVideoFileId: string | number | null;
declare let currentLibrarySubtitleFileId: string | number | null;
declare let runtimePrefetchWindowStart: number;
declare let runtimePrefetchWindowEnd: number;
declare let runtimeNextPrefetchStart: number;
declare let runtimePrefetchAllInProgress: boolean;
declare let deckNoteRefreshTimer: ReturnType<typeof setTimeout> | null;

interface RuntimeWordStatusInfo {
    status?: string;
    [key: string]: unknown;
}

interface AnkiHighlightRefreshResult {
    count?: number;
    cardsChecked?: number;
    notesFound?: number;
    notesChecked?: number;
    importedWords?: number;
    preservedLockedWords?: number;
}

declare const ankiRuntimeWordStatusMap: Map<string, RuntimeWordStatusInfo>;

declare function t(key: string, params?: Record<string, unknown>): string;
declare function getApiErrorMessage(data: ApiPayload | null | undefined, fallback?: string): string;
declare function fetchWithRetry(
    url: string,
    options: RequestInit | undefined,
    settings?: {
        retries?: number;
        delayMs?: number;
        label?: string;
    }
): Promise<Response>;
declare function showToast(message: string, type?: ToastType, duration?: number): void;
declare function showActionToast(
    message: string,
    actions: Array<{ label: string; onClick: () => void | Promise<void> }>,
    type?: ToastType,
    duration?: number
): void;
declare function renderSubtitles(): void;
declare function renderSubtitleOverlay(options: {
    overlay: HTMLElement | null;
    text: string;
    highlighter?: unknown;
}): void;
declare function parseSRT(data: string): SubtitleCue[];
declare function parseASS(data: string): SubtitleCue[];
declare function tokenizeJapaneseText(text: string): Promise<JapaneseToken[]>;
declare function tokenizeJapaneseTextSync(text: string): JapaneseToken[] | null;
declare function restoreSubtitleFromCurrentTime(): void;
declare function prefetchRuntimeStatusesForAllSubtitles(options?: {
    silent?: boolean;
    startIndex?: number;
}): void;
declare function clearRuntimeWordStatuses(): void;
declare function updatePlayButton(): void;
declare function clearSearchMatches(): void;
declare function syncSubtitleStyle(index: number): void;
declare const ankiSubtitleHighlighter: unknown;
declare function getSubtitleContextSelection(index: number): {
    startTime: number;
    endTime: number;
    text: string;
};
declare function getCurrentVideoPayload(): CurrentVideoPayload | null;
declare function loadAudioTrackList(videoRef: string | { videoFileId: string | number }): Promise<void>;
declare function resetLibraryProgressTracking(): void;
declare function saveLibraryWatchProgress(options?: {
    force?: boolean;
    completed?: boolean;
    skipAutoCompletePrompt?: boolean;
    rethrowErrors?: boolean;
}): Promise<unknown>;
declare const kuromoji: NonNullable<Window["kuromoji"]>;
declare function addRuntimeKnownBasicWord(word: string): void;
declare function loadHighlightWordIndexes(options?: { force?: boolean }): Promise<unknown>;
declare function collectSubtitleCandidates(text: string): string[];
declare function ensureStatusesForCandidates(candidates: string[], options?: { silent?: boolean }): Promise<unknown>;
declare function ensureStatusesForSubtitleText(
    text: string,
    options?: { rerender?: boolean; silent?: boolean }
): Promise<unknown>;
declare function rerenderCurrentSubtitleWithAnkiHighlighter(): void;
declare function refreshKnownAnkiWordFromNote(options?: {
    noteId?: string | number;
    word?: string;
    wordFields?: string[] | null;
}): Promise<unknown>;
declare function getHighlightWordFieldNames(): string[];
declare function refreshKnownAnkiWordsFromAnki(options?: { fullRebuild?: boolean }): Promise<AnkiHighlightRefreshResult>;
declare function checkKnownAnkiWordsStaleOnPlayerOpen(options?: { silent?: boolean }): Promise<unknown>;
declare function initSubtitleSidebar(): void;
declare function getCurrentSearchMatch(): SubtitleSearchMatch | null;
declare function seekBySubtitle(offset: number): void;
declare function isSubtitleContextDepthDefault(): boolean;
declare function resetSubtitleContextDepths(): void;
