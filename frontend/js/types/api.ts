export interface ApiErrorInfo {
    code?: string;
    message?: string;
    details?: unknown;
}

export interface ApiPayload {
    ok?: boolean;
    error?: string | ApiErrorInfo;
    errorInfo?: ApiErrorInfo;
    [key: string]: unknown;
}

export interface ApiResult<T extends ApiPayload = ApiPayload> {
    response: Response;
    data: T;
}

export interface CurrentVideoResponse extends ApiPayload {
    filename?: string | null;
    subtitleFilename?: string | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
}

export interface VideoListItem {
    filename: string;
    subtitleFilename?: string | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
}

export interface VideoListResponse extends ApiPayload {
    videos?: VideoListItem[];
}

export interface SubtitleItem {
    start: number;
    end: number;
    text: string;
}

export interface SubtitleResponse extends ApiPayload {
    subtitles?: SubtitleItem[];
    filename?: string;
}

export interface MediaExportResponse extends ApiPayload {
    filename?: string;
    url?: string;
    cached?: boolean;
}

export interface LibrarySeries {
    id: number;
    title: string;
    posterUrl?: string | null;
    episodesCount?: number;
    linkStatus?: string;
    completedEpisodes?: number;
    totalEpisodes?: number;
    videoCount?: number;
    subtitleCount?: number;
    episodesWithVideo?: number;
    episodesWithSubtitle?: number;
    inProgressEpisodes?: number;
    currentTimeSeconds?: number;
    watchedSeconds?: number;
    lastWatchedAt?: string | null;
    createdAt?: string | null;
    coverUrl?: string | null;
}

export interface LibraryEpisode {
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
    hasVideo?: boolean;
    hasSubtitle?: boolean;
    videoFilename?: string | null;
    subtitleFilename?: string | null;
    lastWatchedAt?: string | null;
}

export interface LibrarySeriesListResponse extends ApiPayload {
    series?: LibrarySeries[];
    summary?: unknown;
}

export interface LibrarySeriesDetailResponse extends ApiPayload {
    series?: LibrarySeries;
    episodes?: LibraryEpisode[];
}

export interface LibraryPlaybackResponse extends ApiPayload {
    episode?: LibraryEpisode;
    video?: unknown;
    subtitle?: unknown;
}

export interface JobResponse extends ApiPayload {
    jobId?: string;
    status?: "queued" | "running" | "done" | "failed" | string;
    result?: unknown;
}

export interface LibraryFolderDialogResponse extends ApiPayload {
    path?: string;
}

export interface LibraryJobStatusResponse extends JobResponse {
    progress?: unknown;
}

export interface LibrarySubtitleSearchResponse extends ApiPayload {
    results?: unknown[];
}

export interface LibrarySubtitlePlanResponse extends ApiPayload {
    plan?: unknown;
}

export interface LibraryCoverSearchResponse extends ApiPayload {
    results?: unknown[];
}

export interface LibraryMutationResponse extends ApiPayload {
    series?: LibrarySeries;
    episode?: LibraryEpisode;
    count?: number;
    unresolved?: number;
}

export interface KnownWordsResponse extends ApiPayload {
    words?: string[];
    statuses?: Record<string, string>;
    settings?: HighlightSettingsResponse;
}

export interface HighlightSettingsResponse extends ApiPayload {
    autoRefreshInterval?: "off" | "daily" | "weekly" | string;
    deckNames?: string[];
    wordFields?: string[];
    updatedAt?: string | null;
}
