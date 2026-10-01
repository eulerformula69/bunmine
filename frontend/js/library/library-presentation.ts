import { TranslationKey } from "../core/i18n.js";
import { formatTime, formatBytes, escapeHtml } from "../core/formatters.js";
import { LibraryEpisodeView,LibraryFilterState,LibraryPrimaryAction,LibrarySeriesFilter,LibrarySeriesStatus,LibrarySeriesView } from "./library-types.js";

export type LibraryTranslate = (key: TranslationKey, params?: Record<string, unknown>) => string;

export const LibraryPresentation = {
    progressThresholdSeconds: 5,

    episodeCanResume(episode: LibraryEpisodeView): boolean {
        return !episode.completed && Number(episode.currentTimeSeconds || 0) > this.progressThresholdSeconds;
    },

    seriesStatus(series: LibrarySeriesView): LibrarySeriesStatus {
        const total = Number(series.episodesCount || 0);
        const completed = Number(series.completedEpisodes || 0);
        if (total > 0 && completed >= total) return "completed";
        if (completed > 0 || Number(series.inProgressEpisodes || 0) > 0 || Number(series.currentTimeSeconds || 0) > 5) {
            return "watching";
        }
        return "not-started";
    },

    primaryAction(series: LibrarySeriesView, episodes: LibraryEpisodeView[] = []): LibraryPrimaryAction {
        const status = this.seriesStatus(series);
        const playable = episodes.filter((episode) => episode.hasVideo);
        const current = playable.find((episode) => this.episodeCanResume(episode));
        const next = playable.find((episode) => !episode.completed);
        if (current) return { kind: "continue", episodeId: current.id };
        if (status === "not-started" && next) return { kind: "start", episodeId: next.id };
        if (status === "watching" && next) return { kind: "continue", episodeId: next.id };
        return { kind: "open", episodeId: playable[0]?.id || null };
    },

    matchesFilter(series: LibrarySeriesView, filter: LibrarySeriesFilter): boolean {
        if (filter === "all") return true;
        if (filter === "missing-video") return Number(series.episodesWithVideo || 0) < Number(series.episodesCount || 0);
        if (filter === "missing-subtitles") return Number(series.episodesWithSubtitle || 0) < Number(series.episodesCount || 0);
        if (filter === "file-problems") return series.linkStatus !== "linked";
        return this.seriesStatus(series) === filter;
    },

    filterAndSort(series: LibrarySeriesView[], state: LibraryFilterState): LibrarySeriesView[] {
        const query = state.query.trim().toLocaleLowerCase();
        const result = series.filter((item) => (
            this.matchesFilter(item, state.filter) && (!query || String(item.title || "").toLocaleLowerCase().includes(query))
        ));
        return result.sort((left, right) => {
            if (state.sort === "title") return String(left.title).localeCompare(String(right.title));
            if (state.sort === "progress") {
                const ratio = (item: LibrarySeriesView) => Number(item.completedEpisodes || 0) / Math.max(1, Number(item.episodesCount || 0));
                return ratio(right) - ratio(left) || String(left.title).localeCompare(String(right.title));
            }
            const field = state.sort === "recently-added" ? "createdAt" : "lastWatchedAt";
            return String(right[field] || "").localeCompare(String(left[field] || "")) || String(left.title).localeCompare(String(right.title));
        });
    },
    formatTime: (seconds: unknown): string => formatTime(seconds, "duration"),
    formatBytes,
    escapeHtml,

    linkStatus(episodes: LibraryEpisodeView[]): string {
        const items = Array.isArray(episodes) ? episodes : [];
        if (!items.length) return "missing";

        const videos = items.filter((episode) => episode.hasVideo).length;
        const subtitles = items.filter((episode) => episode.hasSubtitle).length;
        if (videos <= 0 && subtitles <= 0) return "missing";
        if (videos === items.length && subtitles === items.length) return "linked";
        return "partial";
    },

    statusLabel(status: string, translate: LibraryTranslate): string {
        if (status === "linked") return translate("allLinked");
        if (status === "partial") return translate("partiallyLinked");
        return translate("missingFiles");
    },

    planStatusLabel(status: string, translate: LibraryTranslate): string {
        const key = status === "ready"
            ? "ready"
            : status === "needs-review"
                ? "needsReview"
                : status === "failed"
                    ? "failed"
                    : "skipped";
        return translate(key);
    },
};
