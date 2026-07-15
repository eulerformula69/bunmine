interface LibrarySeriesView extends LibrarySeries {
    cardsCount?: number;
    episodesWithVideo?: number;
    episodesWithSubtitle?: number;
    coverUrl?: string | null;
}

type LibrarySeriesStatus = "not-started" | "watching" | "completed";
type LibrarySeriesFilter = "all" | LibrarySeriesStatus | "missing-video" | "missing-subtitles" | "file-problems";
type LibrarySeriesSort = "last-watched" | "progress" | "title" | "recently-added";

interface LibraryFilterState {
    filter: LibrarySeriesFilter;
    sort: LibrarySeriesSort;
    query: string;
}

interface LibraryPrimaryAction {
    kind: "start" | "continue" | "open";
    episodeId: number | null;
}

interface LibraryEpisodeView extends LibraryEpisode {
    hasVideo?: boolean;
    hasSubtitle?: boolean;
    linkStatus?: string;
    videoFilename?: string | null;
    subtitleFilename?: string | null;
}

interface SubtitleEpisodeSelection {
    episode: LibraryEpisodeView;
    row: HTMLElement;
}

interface LibraryJobData extends ApiPayload {
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

interface SubtitleCandidate {
    source?: string;
    entryId?: string | number;
    entryTitle?: string;
    releaseKey?: string;
    releaseLabel?: string;
    filename?: string;
    downloadUrl?: string;
    [key: string]: unknown;
}

interface BulkSubtitlePlanItem {
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

interface BulkSubtitlePlan {
    items?: BulkSubtitlePlanItem[];
    entriesChecked?: number;
    [key: string]: unknown;
}

interface CoverSearchResult {
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
