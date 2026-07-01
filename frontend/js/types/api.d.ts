interface ApiErrorInfo {
    code?: string;
    message?: string;
    details?: unknown;
}

interface ApiPayload {
    ok?: boolean;
    error?: string | ApiErrorInfo;
    errorInfo?: ApiErrorInfo;
    [key: string]: unknown;
}

interface ApiResult<T extends ApiPayload = ApiPayload> {
    response: Response;
    data: T;
}

interface CurrentVideoResponse extends ApiPayload {
    filename?: string | null;
    subtitleFilename?: string | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
}

interface VideoListItem {
    filename: string;
    subtitleFilename?: string | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
}

interface VideoListResponse extends ApiPayload {
    videos?: VideoListItem[];
}

interface SubtitleItem {
    start: number;
    end: number;
    text: string;
}

interface SubtitleResponse extends ApiPayload {
    subtitles?: SubtitleItem[];
    filename?: string;
}

interface MediaExportResponse extends ApiPayload {
    filename?: string;
    url?: string;
    cached?: boolean;
}

interface LibrarySeries {
    id: number;
    title: string;
    posterUrl?: string | null;
    episodesCount?: number;
    linkStatus?: string;
    completedEpisodes?: number;
    totalEpisodes?: number;
    videoCount?: number;
    subtitleCount?: number;
}

interface LibraryEpisode {
    id: number;
    title?: string;
    episodeNumber?: number | null;
    videoFileId?: number | null;
    subtitleFileId?: number | null;
    completed?: boolean;
    progressSeconds?: number;
    currentTimeSeconds?: number;
    watchedSeconds?: number;
    durationSeconds?: number;
}

interface LibrarySeriesListResponse extends ApiPayload {
    series?: LibrarySeries[];
    summary?: unknown;
}

interface LibrarySeriesDetailResponse extends ApiPayload {
    series?: LibrarySeries;
    episodes?: LibraryEpisode[];
}

interface LibraryPlaybackResponse extends ApiPayload {
    episode?: LibraryEpisode;
    video?: unknown;
    subtitle?: unknown;
}

interface JobResponse extends ApiPayload {
    jobId?: string;
    status?: "queued" | "running" | "done" | "failed" | string;
    result?: unknown;
}

interface LibraryFolderDialogResponse extends ApiPayload {
    path?: string;
}

interface LibraryJobStatusResponse extends JobResponse {
    progress?: unknown;
}

interface LibrarySubtitleSearchResponse extends ApiPayload {
    results?: unknown[];
}

interface LibrarySubtitlePlanResponse extends ApiPayload {
    plan?: unknown;
}

interface LibraryCoverSearchResponse extends ApiPayload {
    results?: unknown[];
}

interface LibraryMutationResponse extends ApiPayload {
    series?: LibrarySeries;
    episode?: LibraryEpisode;
    count?: number;
    unresolved?: number;
}

interface KnownWordsResponse extends ApiPayload {
    words?: string[];
    statuses?: Record<string, string>;
    settings?: HighlightSettingsResponse;
}

interface HighlightSettingsResponse extends ApiPayload {
    autoRefreshInterval?: "off" | "daily" | "weekly" | string;
    deckNames?: string[];
    wordFields?: string[];
    updatedAt?: string | null;
}
