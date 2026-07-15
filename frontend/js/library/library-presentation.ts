type LibraryTranslate = (key: string, params?: Record<string, unknown>) => string;

const LibraryPresentation = {
    formatTime(seconds: unknown): string {
        const value = Number(seconds || 0);
        if (value <= 0) return "0m";

        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    },

    formatBytes(bytes: unknown): string {
        const value = Number(bytes || 0);
        if (value <= 0) return "";
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    },

    escapeHtml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    },

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
