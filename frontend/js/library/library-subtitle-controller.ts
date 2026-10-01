import { LibraryEpisodeView,LibrarySeriesView,SubtitleCandidate,SubtitleEpisodeSelection } from "./library-types.js";
import { createLibrarySearchModal } from "./search-modal.js";

import { LibraryTranslate } from "./library-presentation.js";

import { ApiPayload,LibraryMutationResponse } from "../types/api.js";

export interface LibrarySubtitleControllerOptions {
    modal: HTMLElement;
    title: HTMLElement;
    subtitle: HTMLElement;
    searchInput: HTMLInputElement;
    searchButton: HTMLButtonElement;
    results: HTMLElement;
    getSeries: () => LibrarySeriesView | null;
    translate: LibraryTranslate;
    escapeHtml: (value: unknown) => string;
    formatBytes: (value: unknown) => string;
    search: (episodeId: string | number, query: string) => Promise<{ response: Response; data: ApiPayload }>;
    select: (episodeId: string | number, payload: Record<string, unknown>) => Promise<{ response: Response; data: ApiPayload }>;
    refreshSeriesStatus: () => void;
    reportError?: (message: string) => void;
}

export function createLibrarySubtitleController(options: LibrarySubtitleControllerOptions) {
    const t = options.translate;
    const controller = createLibrarySearchModal<SubtitleEpisodeSelection, SubtitleCandidate>(options, {
        describe: ({episode}) => ({id: episode.id, query: options.getSeries()?.title || "",
            title: t(episode.hasSubtitle ? "changeJapaneseSubtitles" : "findJapaneseSubtitles"),
            subtitle: `${options.getSeries()?.title} · ${t("episodeLabel", {number: episode.episodeNumber ?? "?"})}`}),
        render(result) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "subtitle-result-item";
            const meta = [result.entryTitle, result.extension, options.formatBytes(result.sizeBytes),
                result.lastModified ? String(result.lastModified).slice(0, 10) : null]
                .filter(Boolean).join(" · ");
            item.innerHTML = `<div class="cover-result-info">
                <div class="cover-result-title">${options.escapeHtml(result.filename || t("untitledSubtitle"))}</div>
                <div class="cover-result-meta">${options.escapeHtml(meta)}</div>
            </div>`;

            return item;
        },
        payload: result => ({source: result.source, entryId: result.entryId, filename: result.filename, downloadUrl: result.downloadUrl}),
        saved({episode,row},data) {
            episode.hasSubtitle = true;
            episode.subtitleFileId = (data as LibraryMutationResponse & { subtitleFileId?: number | null }).subtitleFileId;
            episode.linkStatus = episode.hasVideo ? "linked" : "partial";
            const button = row.querySelector(".subtitle-file-action");
            if (button) button.textContent = t("changeJpSubs");
            if (typeof data.subtitleFilename === "string") episode.subtitleFilename = data.subtitleFilename;
            const filename = row.querySelector(".subtitle-filename");
            if (filename) filename.textContent = episode.subtitleFilename || t("subtitlesYes");
            options.refreshSeriesStatus();

        },
        empty: "noDirectSubtitles", searching: "searchingJimaku", searchError: "subtitleSearchFailed",
        saveError: "couldNotSaveSubtitle", initialHint: "subtitleQueryHint"
    });
    return {...controller, async open(episode: LibraryEpisodeView, row: HTMLElement) {
        if (options.getSeries()) await controller.open({episode,row});
    }};
}
