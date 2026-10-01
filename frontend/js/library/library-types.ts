import { ApiPayload,LibraryEpisode,LibrarySeries } from "../types/api.js";

export interface LibrarySeriesView extends LibrarySeries {
    cardsCount?: number;
    episodesWithVideo?: number;
    episodesWithSubtitle?: number;
    coverUrl?: string | null;
}

export type LibrarySeriesStatus = "not-started" | "watching" | "completed";

export type LibrarySeriesFilter = "all" | LibrarySeriesStatus | "missing-video" | "missing-subtitles" | "file-problems";

export type LibrarySeriesSort = "last-watched" | "progress" | "title" | "recently-added";

export interface LibraryFilterState {
    filter: LibrarySeriesFilter;
    sort: LibrarySeriesSort;
    query: string;
}

export interface LibraryPrimaryAction {
    kind: "start" | "continue" | "open";
    episodeId: number | null;
}

export interface LibraryEpisodeView extends LibraryEpisode {
    hasVideo?: boolean;
    hasSubtitle?: boolean;
    linkStatus?: string;
    videoFilename?: string | null;
    subtitleFilename?: string | null;
}

export interface SubtitleEpisodeSelection {
    episode: LibraryEpisodeView;
    row: HTMLElement;
}

export interface LibraryJobData extends ApiPayload {
    job?: {
        id?: string;
        status?: string;
        error?: string;
        result?: {
            error?: string;
            filesFound?: number;
            [key: string]: unknown;
        };
    };
}

export interface SubtitleCandidate {
    source?: string;
    entryId?: string | number;
    entryTitle?: string;
    releaseKey?: string;
    releaseLabel?: string;
    filename?: string;
    downloadUrl?: string;
    [key: string]: unknown;
}

export interface BulkSubtitlePlanItem {
    episodeId: string | number;
    episodeNumber?: string | number | null;
    episodeTitle?: string | null;
    status?: string;
    message?: string;
    selected?: SubtitleCandidate | null;
    candidates?: SubtitleCandidate[];
    alternativesCount?: number;
    [key: string]: unknown;
}

export interface BulkSubtitlePlan {
    items?: BulkSubtitlePlanItem[];
    entriesChecked?: number;
    [key: string]: unknown;
}

export interface CoverSearchResult {
    source?: string;
    externalId?: string | number;
    coverUrl?: string;
    title?: string;
    preferredTitle?: string;
    englishTitle?: string;
    nativeTitle?: string;
    format?: string;
    seasonYear?: string | number;
    episodes?: number;
}
