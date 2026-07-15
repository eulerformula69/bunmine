interface LibrarySubtitleControllerOptions {
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

function createLibrarySubtitleController(options: LibrarySubtitleControllerOptions) {
    let current: SubtitleEpisodeSelection | null = null;
    const t = options.translate;

    function openModal(): void {
        options.modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function close(): void {
        options.modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
        current = null;
    }

    function render(results: SubtitleCandidate[]): void {
        options.results.innerHTML = "";
        if (!results.length) {
            options.results.innerHTML = `<div class="cover-message">${options.escapeHtml(t("noDirectSubtitles"))}</div>`;
            return;
        }
        for (const result of results) {
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
            item.addEventListener("click", () => selectResult(result));
            options.results.appendChild(item);
        }
    }

    async function open(episode: LibraryEpisodeView, row: HTMLElement): Promise<void> {
        const series = options.getSeries();
        if (!series) return;
        current = { episode, row };
        options.title.textContent = episode.hasSubtitle ? t("changeJapaneseSubtitles") : t("findJapaneseSubtitles");
        options.subtitle.textContent = `${series.title} · ${t("episodeLabel", { number: episode.episodeNumber ?? "?" })}`;
        options.searchInput.value = series.title;
        options.results.innerHTML = `<div class="cover-message">${options.escapeHtml(t("subtitleQueryHint"))}</div>`;
        openModal();
        options.searchInput.focus();
        options.searchInput.select();
    }

    async function searchCurrent(): Promise<void> {
        if (!current) return;
        const query = options.searchInput.value.trim() || options.getSeries()?.title || "";
        options.searchButton.disabled = true;
        options.searchButton.textContent = t("searching");
        options.results.innerHTML = `<div class="cover-message">${options.escapeHtml(t("searchingJimaku"))}</div>`;
        try {
            const { response, data } = await options.search(current.episode.id, query);
            if (!response.ok || data.error) throw new Error(String(data.error || t("subtitleSearchFailed")));
            render((data.results || []) as SubtitleCandidate[]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            options.results.innerHTML = `<div class="cover-message error">${options.escapeHtml(message)}</div>`;
        } finally {
            options.searchButton.disabled = false;
            options.searchButton.textContent = t("search");
        }
    }

    async function selectResult(result: SubtitleCandidate): Promise<void> {
        if (!current) return;
        const { episode, row } = current;
        options.results.classList.add("is-loading");
        try {
            const { response, data } = await options.select(episode.id, {
                source: result.source, entryId: result.entryId,
                filename: result.filename, downloadUrl: result.downloadUrl,
            });
            if (!response.ok || data.error) throw new Error(String(data.error || t("couldNotSaveSubtitle")));
            episode.hasSubtitle = true;
            episode.subtitleFileId = (data as LibraryMutationResponse & { subtitleFileId?: number | null }).subtitleFileId;
            episode.linkStatus = episode.hasVideo ? "linked" : "partial";
            const meta = row.querySelector(".episode-meta");
            if (meta) {
                const watched = row.querySelector("[data-episode-watched-text]")?.outerHTML || "";
                meta.innerHTML = `${episode.hasVideo ? t("videoYes") : t("videoNo")} <span>·</span> <span>${t("subtitlesYes")}</span> <button class="find-subtitles-btn find-subtitles-btn-inline" type="button" ${episode.hasVideo ? "" : "disabled"} data-episode-id="${options.escapeHtml(episode.id)}">${t("changeJpSubs")}</button> <span>·</span> ${watched}`;
            }
            const button = row.querySelector(".find-subtitles-btn");
            if (button) button.textContent = t("changeJpSubs");
            options.refreshSeriesStatus();
            close();
        } catch (error) {
            options.reportError?.(error instanceof Error ? error.message : String(error));
        } finally {
            options.results.classList.remove("is-loading");
        }
    }

    return { open, close, search: searchCurrent };
}
