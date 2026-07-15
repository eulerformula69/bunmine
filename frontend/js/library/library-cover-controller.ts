interface LibraryCoverControllerOptions {
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

function createLibraryCoverController(options: LibraryCoverControllerOptions) {
    let currentSeries: LibrarySeriesView | null = null;
    const t = options.translate;

    function openModal(): void {
        options.modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function closeModal(): void {
        options.modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
        currentSeries = null;
    }

    function render(results: CoverSearchResult[]): void {
        options.results.innerHTML = "";
        if (!results.length) {
            options.results.innerHTML = `<div class="cover-message">${options.escapeHtml(t("noResultsFound"))}</div>`;
            return;
        }

        for (const result of results) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "cover-result-item";
            const meta = [result.format, result.seasonYear, result.episodes ? `${result.episodes} ${t("eps")}` : null]
                .filter(Boolean).join(" · ");
            item.innerHTML = `
                <img src="${options.escapeHtml(result.coverUrl)}" alt="">
                <div class="cover-result-info">
                    <div class="cover-result-title">${options.escapeHtml(result.title || result.preferredTitle || t("untitled"))}</div>
                    <div class="cover-result-subtitle">${options.escapeHtml(result.englishTitle || result.nativeTitle || "")}</div>
                    <div class="cover-result-meta">${options.escapeHtml(meta)}</div>
                </div>`;
            item.addEventListener("click", () => selectResult(result));
            options.results.appendChild(item);
        }
    }

    async function searchCurrent(): Promise<void> {
        if (!currentSeries) return;
        const series = currentSeries;
        const query = options.searchInput.value.trim() || series.title;
        options.searchButton.disabled = true;
        options.searchButton.textContent = t("searching");
        options.results.innerHTML = `<div class="cover-message">${options.escapeHtml(t("searchingAniList"))}</div>`;
        try {
            const { response, data } = await options.search(series.id, query);
            if (!response.ok || data.error) throw new Error(String(data.error || t("coverSearchFailed")));
            render((data.results || []) as CoverSearchResult[]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            options.results.innerHTML = `<div class="cover-message error">${options.escapeHtml(message)}</div>`;
        } finally {
            options.searchButton.disabled = false;
            options.searchButton.textContent = t("search");
        }
    }

    async function open(series: LibrarySeriesView): Promise<void> {
        currentSeries = series;
        options.title.textContent = series.coverUrl ? t("changeCover") : t("findCover");
        options.subtitle.textContent = series.title;
        options.searchInput.value = series.title;
        options.results.innerHTML = "";
        openModal();
        await searchCurrent();
    }

    async function selectResult(result: CoverSearchResult): Promise<void> {
        if (!currentSeries) return;
        options.results.classList.add("is-loading");
        try {
            const { response, data } = await options.select(currentSeries.id, {
                source: result.source, externalId: result.externalId, coverUrl: result.coverUrl,
            });
            if (!response.ok || data.error) throw new Error(String(data.error || t("couldNotSaveCover")));
            closeModal();
            await options.reload();
        } catch (error) {
            options.reportError?.(error instanceof Error ? error.message : String(error));
        } finally {
            options.results.classList.remove("is-loading");
        }
    }

    return { open, close: closeModal, search: searchCurrent };
}
