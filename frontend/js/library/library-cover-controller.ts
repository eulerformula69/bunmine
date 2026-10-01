import { LibraryTranslate } from "./library-presentation.js";
import { createLibrarySearchModal } from "./search-modal.js";

import { ApiPayload } from "../types/api.js";

import { CoverSearchResult,LibrarySeriesView } from "./library-types.js";

export interface LibraryCoverControllerOptions {
    modal: HTMLElement;
    title: HTMLElement;
    subtitle: HTMLElement;
    searchInput: HTMLInputElement;
    searchButton: HTMLButtonElement;
    results: HTMLElement;
    translate: LibraryTranslate;
    escapeHtml: (value: unknown) => string;
    search: (seriesId: string | number, query: string) => Promise<{ response: Response; data: ApiPayload }>;
    select: (seriesId: string | number, payload: Record<string, unknown>) => Promise<{ response: Response; data: ApiPayload }>;
    reload: () => Promise<unknown>;
    reportError?: (message: string) => void;
}

export function createLibraryCoverController(options: LibraryCoverControllerOptions) {
    const t = options.translate;
    return createLibrarySearchModal<LibrarySeriesView, CoverSearchResult>(options, {
        describe: series => ({ id: series.id, query: series.title,
            title: t(series.coverUrl ? "changeCover" : "findCover"), subtitle: series.title }),
        render(result) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "cover-result-item";
            const meta = [result.source === "kitsu" ? "Kitsu" : "AniList", result.format, result.seasonYear, result.episodes ? `${result.episodes} ${t("eps")}` : null]
                .filter(Boolean).join(" · ");
            item.innerHTML = `
                <img src="${options.escapeHtml(result.coverUrl)}" alt="">
                <div class="cover-result-info">
                    <div class="cover-result-title">${options.escapeHtml(result.title || result.preferredTitle || t("untitled"))}</div>
                    <div class="cover-result-subtitle">${options.escapeHtml(result.englishTitle || result.nativeTitle || "")}</div>
                    <div class="cover-result-meta">${options.escapeHtml(meta)}</div>
                </div>`;

            return item;
        },
        payload: result => ({source: result.source, externalId: result.externalId, coverUrl: result.coverUrl}),
        saved: () => options.reload(), closeBeforeSaved: true, searchOnOpen: true,
        empty: "noResultsFound", searching: "searching", searchError: "coverSearchFailed", saveError: "couldNotSaveCover"
    });
}
