function applyLibraryLanguage() {
    libraryCurrentLang = loadLibraryLanguage();
    document.documentElement.lang = libraryCurrentLang;
    document.title = lt("libraryTitle");
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (key) element.textContent = lt(key);
    });
    document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((element) => {
        element.placeholder = lt(element.dataset.i18nPlaceholder || "");
    });
}

const seriesGrid = document.getElementById("seriesGrid") as HTMLElement;
const librarySummary = document.getElementById("librarySummary") as HTMLElement;
const catalogResultSummary = document.getElementById("catalogResultSummary") as HTMLElement;
const catalogEmpty = document.getElementById("catalogEmpty") as HTMLElement;
const catalogView = document.getElementById("catalogView") as HTMLElement;
const seriesView = document.getElementById("seriesView") as HTMLElement;
const libraryHeader = document.querySelector(".library-header") as HTMLElement;
const scanLibraryBtn = document.getElementById("scanLibraryBtn") as HTMLButtonElement;
const addAnimeBtn = document.getElementById("addAnimeBtn") as HTMLButtonElement;
const librarySearchInput = document.getElementById("librarySearchInput") as HTMLInputElement;
const libraryFilters = document.getElementById("libraryFilters") as HTMLElement;
const seriesTitle = document.getElementById("seriesTitle") as HTMLElement;
const seriesStatus = document.getElementById("seriesStatus") as HTMLElement;
const seriesStats = document.getElementById("seriesStats") as HTMLElement;
const seriesCurrentEpisode = document.getElementById("seriesCurrentEpisode") as HTMLElement;
const seriesDetailCover = document.getElementById("seriesDetailCover") as HTMLElement;
const seriesPrimaryAction = document.getElementById("seriesPrimaryAction") as HTMLAnchorElement;
const episodeList = document.getElementById("episodeList") as HTMLElement;
const fileList = document.getElementById("fileList") as HTMLElement;
const seriesTabs = document.getElementById("seriesTabs") as HTMLElement;
const closeSeriesPanelBtn = document.getElementById("closeSeriesPanelBtn") as HTMLButtonElement;
const changeSeriesCoverBtn = document.getElementById("changeSeriesCoverBtn") as HTMLButtonElement;
const downloadMissingSubtitlesBtn = document.getElementById("downloadMissingSubtitlesBtn") as HTMLButtonElement;
const relinkSeriesFilesBtn = document.getElementById("relinkSeriesFilesBtn") as HTMLButtonElement;
const deleteSeriesBtn = document.getElementById("deleteSeriesBtn") as HTMLButtonElement;

const coverModal = document.getElementById("coverModal") as HTMLElement;
const coverModalTitle = document.getElementById("coverModalTitle") as HTMLElement;
const coverModalSubtitle = document.getElementById("coverModalSubtitle") as HTMLElement;
const closeCoverModalBtn = document.getElementById("closeCoverModalBtn") as HTMLButtonElement;
const coverSearchInput = document.getElementById("coverSearchInput") as HTMLInputElement;
const coverSearchBtn = document.getElementById("coverSearchBtn") as HTMLButtonElement;
const coverResults = document.getElementById("coverResults") as HTMLElement;
const subtitleModal = document.getElementById("subtitleModal") as HTMLElement;
const subtitleModalTitle = document.getElementById("subtitleModalTitle") as HTMLElement;
const subtitleModalSubtitle = document.getElementById("subtitleModalSubtitle") as HTMLElement;
const closeSubtitleModalBtn = document.getElementById("closeSubtitleModalBtn") as HTMLButtonElement;
const subtitleSearchInput = document.getElementById("subtitleSearchInput") as HTMLInputElement;
const subtitleSearchBtn = document.getElementById("subtitleSearchBtn") as HTMLButtonElement;
const subtitleResults = document.getElementById("subtitleResults") as HTMLElement;
const bulkSubtitleModal = document.getElementById("bulkSubtitleModal") as HTMLElement;
const bulkSubtitleModalTitle = document.getElementById("bulkSubtitleModalTitle") as HTMLElement;
const bulkSubtitleModalSubtitle = document.getElementById("bulkSubtitleModalSubtitle") as HTMLElement;
const closeBulkSubtitleModalBtn = document.getElementById("closeBulkSubtitleModalBtn") as HTMLButtonElement;
const bulkSubtitleSearchInput = document.getElementById("bulkSubtitleSearchInput") as HTMLInputElement;
const bulkSubtitleSearchBtn = document.getElementById("bulkSubtitleSearchBtn") as HTMLButtonElement;
const bulkSubtitleStatus = document.getElementById("bulkSubtitleStatus") as HTMLElement;
const bulkSubtitleSets = document.getElementById("bulkSubtitleSets") as HTMLElement;
const bulkSubtitleList = document.getElementById("bulkSubtitleList") as HTMLElement;
const confirmBulkSubtitleDownloadBtn = document.getElementById("confirmBulkSubtitleDownloadBtn") as HTMLButtonElement;
const cancelBulkSubtitleDownloadBtn = document.getElementById("cancelBulkSubtitleDownloadBtn") as HTMLButtonElement;

let librarySeries: LibrarySeriesView[] = [];
let currentOpenedSeries: LibrarySeriesView | null = null;
let currentOpenedEpisodes: LibraryEpisodeView[] = [];
let currentBulkSubtitlePlan: BulkSubtitlePlan | null = null;
let currentBulkSubtitleSetKey: string | null = null;
let isBulkSubtitleDownloading = false;
let isBulkSubtitlePreparing = false;
const JIMAKU_PLAN_REQUEST_DELAY_MS = 1300;
const JIMAKU_429_DEFAULT_WAIT_MS = 12000;
const JIMAKU_429_MAX_RETRIES = 4;
const JIMAKU_DOWNLOAD_CONCURRENCY = 2;
const LIBRARY_VIEW_STATE_KEY = "bunmineLibraryViewState";
const VALID_FILTERS: LibrarySeriesFilter[] = ["all", "watching", "not-started", "completed", "missing-video", "missing-subtitles", "file-problems"];
const VALID_SORTS: LibrarySeriesSort[] = ["last-watched", "progress", "title", "recently-added"];

function loadLibraryViewState(): LibraryFilterState {
    try {
        const stored = JSON.parse(localStorage.getItem(LIBRARY_VIEW_STATE_KEY) || "{}");
        return {
            filter: VALID_FILTERS.includes(stored.filter) ? stored.filter : "all",
            sort: VALID_SORTS.includes(stored.sort) ? stored.sort : "last-watched",
            query: "",
        };
    } catch {
        return { filter: "all", sort: "last-watched", query: "" };
    }
}

function saveLibraryViewState() {
    localStorage.setItem(LIBRARY_VIEW_STATE_KEY, JSON.stringify({ filter: filterState.filter, sort: filterState.sort }));
}

const filterState: LibraryFilterState = loadLibraryViewState();

function escapeHtml(value: unknown) { return LibraryPresentation.escapeHtml(value); }
function formatBytes(value: unknown) { return LibraryPresentation.formatBytes(value); }
function formatLibraryTime(value: unknown) { return LibraryPresentation.formatTime(value); }
function statusKeyLabel(status: string) { return LibraryPresentation.planStatusLabel(status, lt); }
function statusLabel(status: LibrarySeriesStatus) { return lt(status === "not-started" ? "notStarted" : status); }
function linkStatusIcon(status: string | undefined) {
    if (status === "linked") return "/icons/chain-ok.svg";
    if (status === "partial") return "/icons/chain-missing.svg";
    return "/icons/chain-broken.svg";
}
function linkStatusTitle(status: string | undefined) {
    return lt(status === "linked" ? "allLinked" : status === "partial" ? "partiallyLinked" : "missingFiles");
}

const FILTER_GROUPS: Array<{ label: string; items: Array<[LibrarySeriesFilter, string]> }> = [
    { label: "myLibrary", items: [["all", "all"], ["watching", "watching"], ["not-started", "notStarted"], ["completed", "completed"]] },
    { label: "files", items: [["missing-video", "missingVideo"], ["missing-subtitles", "missingSubtitles"], ["file-problems", "fileProblems"]] },
];
const SORT_ITEMS: Array<[LibrarySeriesSort, string]> = [["last-watched", "recentlyWatched"], ["progress", "byProgress"], ["title", "byTitle"], ["recently-added", "recentlyAdded"]];

function filterCount(filter: LibrarySeriesFilter) {
    return librarySeries.filter((series) => LibraryPresentation.matchesFilter(series, filter)).length;
}

function renderFilters() {
    libraryFilters.replaceChildren();
    for (const group of FILTER_GROUPS) {
        const section = document.createElement("section");
        section.className = "filter-group";
        const heading = document.createElement("h3");
        heading.textContent = lt(group.label);
        section.appendChild(heading);
        for (const [filter, label] of group.items) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = filterState.filter === filter ? "active" : "";
            button.dataset.filter = filter;
            button.innerHTML = `<span>${escapeHtml(lt(label))}</span><span>${filterCount(filter)}</span>`;
            section.appendChild(button);
        }
        libraryFilters.appendChild(section);
    }
    const sort = document.createElement("section");
    sort.className = "filter-group";
    sort.innerHTML = `<h3>${escapeHtml(lt("sorting"))}</h3>`;
    for (const [value, label] of SORT_ITEMS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = filterState.sort === value ? "active" : "";
        button.dataset.sort = value;
        button.textContent = lt(label);
        sort.appendChild(button);
    }
    libraryFilters.appendChild(sort);
}

function renderCatalog() {
    const visible = LibraryPresentation.filterAndSort([...librarySeries], filterState);
    seriesGrid.replaceChildren(...visible.map(renderSeriesCard));
    catalogEmpty.classList.toggle("hidden", visible.length > 0);
    catalogResultSummary.textContent = lt("showingSeries", { count: visible.length, total: librarySeries.length });
    renderFilters();
}

function renderSeriesCard(item: LibrarySeriesView) {
    const card = document.createElement("article");
    card.className = "series-card";
    card.tabIndex = 0;
    card.dataset.seriesId = String(item.id);
    const total = Number(item.episodesCount || 0);
    const completed = Number(item.completedEpisodes || 0);
    const progress = total ? Math.round(completed / total * 100) : 0;
    const status = LibraryPresentation.seriesStatus(item);
    const cover = item.coverUrl
        ? `<img src="${escapeHtml(item.coverUrl)}" alt="">`
        : `<span class="cover-letter">${escapeHtml(String(item.title || "?").slice(0, 1))}</span>`;
    card.innerHTML = `<div class="series-cover">${cover}<span class="card-action">${escapeHtml(lt(status === "not-started" ? "startWatching" : status === "watching" ? "continueWatching" : "open"))}</span></div><div class="series-card-body"><h3>${escapeHtml(item.title)}</h3><p class="series-state">${escapeHtml(statusLabel(status))} · <span data-completed-episodes>${completed}</span>/<span data-total-episodes>${total}</span></p><div class="progress-bar"><span style="width:${progress}%"></span></div>${Number(item.currentTimeSeconds || 0) > 5 && status === "watching" ? `<p class="continue-note">${escapeHtml(lt("continueAt", { time: formatLibraryTime(item.currentTimeSeconds) }))}</p>` : ""}</div>`;
    const open = () => openSeries(item.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
    return card;
}

async function loadLibrarySeries() {
    librarySummary.textContent = lt("loading");
    const { response, data } = await libraryListSeries();
    if (!response.ok || data.error) throw new Error(data.error || lt("couldNotLoadLibrary"));
    librarySeries = (Array.isArray(data.series) ? data.series : []) as LibrarySeriesView[];
    const total = librarySeries.reduce((sum, item) => sum + Number(item.episodesCount || 0), 0);
    const watched = librarySeries.reduce((sum, item) => sum + Number(item.completedEpisodes || 0), 0);
    librarySummary.textContent = lt("seriesSummary", { count: librarySeries.length, watched, total });
    renderCatalog();
    openSeriesFromHash();
}

function episodeNumber(episode: LibraryEpisodeView) {
    return episode.episodeNumber ?? episode.title ?? "—";
}

function episodeState(episode: LibraryEpisodeView) {
    if (episode.completed) return lt("watched");
    if (Number(episode.currentTimeSeconds || 0) > 5) return lt("inProgress");
    return lt("notWatched");
}

function renderEpisodeRow(episode: LibraryEpisodeView) {
    const row = document.createElement("article");
    row.className = `episode-row${episode.hasVideo ? " clickable" : ""}`;
    const action = Number(episode.currentTimeSeconds || 0) > 5 ? lt("continueWatching") : lt("open");
    row.innerHTML = `<div class="episode-number">${escapeHtml(episodeNumber(episode))}</div><div class="episode-main"><h3>${escapeHtml(episode.title || lt("episodeLabel", { number: episodeNumber(episode) }))}</h3><p><span class="episode-state">${escapeHtml(episodeState(episode))}</span>${Number(episode.currentTimeSeconds || 0) > 5 ? ` · ${escapeHtml(formatLibraryTime(episode.currentTimeSeconds))} / ${escapeHtml(formatLibraryTime(episode.durationSeconds))}` : ""}${!episode.hasSubtitle ? ` · ${escapeHtml(lt("noJp"))}` : ""}${!episode.hasVideo ? ` · ${escapeHtml(lt("missingVideo"))}` : ""}</p></div><div class="episode-actions"><label class="complete-toggle"><input class="episode-completed-checkbox" type="checkbox" ${episode.completed ? "checked" : ""}><span>${escapeHtml(lt("watched"))}</span></label><a class="button small ${episode.hasVideo ? "primary" : "disabled"}" href="/?episodeId=${encodeURIComponent(episode.id)}">${escapeHtml(action)}</a></div>`;
    const checkbox = row.querySelector<HTMLInputElement>("input")!;
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => toggleEpisodeCompleted(episode, checkbox));
    if (episode.hasVideo) row.addEventListener("click", (event) => { if (!(event.target as HTMLElement).closest("a,label,button")) location.href = `/?episodeId=${encodeURIComponent(episode.id)}`; });
    return row;
}

function renderFileRow(episode: LibraryEpisodeView) {
    const row = document.createElement("article");
    row.className = "file-row";
    row.innerHTML = `<div><h3>${escapeHtml(lt("episodeLabel", { number: episodeNumber(episode) }))}</h3><p>${escapeHtml(episode.videoFilename || lt("missingVideo"))}</p><p>${escapeHtml(episode.subtitleFilename || lt("missingSubtitles"))}</p></div><div class="file-actions"><button class="button small subtitle-file-action" type="button" ${episode.hasVideo ? "" : "disabled"}>${escapeHtml(episode.hasSubtitle ? lt("changeJpSubs") : lt("findJpSubs"))}</button>${!episode.hasVideo && !episode.hasSubtitle ? `<button class="button small danger delete-missing-episode-btn" type="button">${escapeHtml(lt("deleteMissingEpisode"))}</button>` : ""}</div>`;
    row.querySelector<HTMLButtonElement>(".subtitle-file-action")?.addEventListener("click", () => openSubtitleSearchModal(episode, row));
    row.querySelector<HTMLButtonElement>(".delete-missing-episode-btn")?.addEventListener("click", () => deleteMissingEpisode(episode));
    return row;
}

async function openSeries(seriesId: string | number, updateHash = true) {
    catalogView.classList.add("hidden");
    seriesView.classList.remove("hidden");
    libraryHeader.classList.add("hidden");
    document.body.classList.add("series-route");
    seriesTitle.textContent = lt("loading");
    episodeList.replaceChildren();
    fileList.replaceChildren();
    const { response, data } = await libraryGetSeries(seriesId);
    if (!response.ok || data.error || !data.series) throw new Error(data.error || lt("couldNotLoadSeries"));
    currentOpenedEpisodes = (data.episodes || []) as LibraryEpisodeView[];
    currentOpenedSeries = { ...(data.series as LibrarySeriesView), completedEpisodes: currentOpenedEpisodes.filter((item) => item.completed).length };
    const series = currentOpenedSeries;
    const status = LibraryPresentation.seriesStatus(series);
    const primary = LibraryPresentation.primaryAction(series, currentOpenedEpisodes);
    const current = currentOpenedEpisodes.find((item) => !item.completed && Number(item.currentTimeSeconds || 0) > 5) || currentOpenedEpisodes.find((item) => !item.completed);
    seriesTitle.replaceChildren();
    const titleIcon = document.createElement("img");
    titleIcon.className = "series-link-status-icon";
    titleIcon.src = linkStatusIcon(series.linkStatus);
    titleIcon.alt = linkStatusTitle(series.linkStatus);
    titleIcon.title = linkStatusTitle(series.linkStatus);
    const titleText = document.createElement("span");
    titleText.textContent = series.title;
    seriesTitle.append(titleIcon, titleText);
    seriesStatus.textContent = statusLabel(status);
    seriesStats.textContent = lt("detailProgress", { watched: series.completedEpisodes, total: series.episodesCount || 0 });
    seriesCurrentEpisode.textContent = current ? lt("currentEpisode", { number: episodeNumber(current) }) : lt("allEpisodesCompleted");
    seriesPrimaryAction.textContent = lt(primary.kind === "start" ? "startWatching" : primary.kind === "continue" ? "continueWatching" : "openEpisodes");
    seriesPrimaryAction.href = primary.episodeId ? `/?episodeId=${encodeURIComponent(primary.episodeId)}` : "#episodes";
    seriesDetailCover.innerHTML = series.coverUrl ? `<img src="${escapeHtml(series.coverUrl)}" alt="">` : `<span class="cover-letter">${escapeHtml(series.title.slice(0, 1))}</span>`;
    episodeList.replaceChildren(...currentOpenedEpisodes.map(renderEpisodeRow));
    fileList.replaceChildren(...currentOpenedEpisodes.map(renderFileRow));
    if (updateHash) history.pushState({ seriesId: series.id }, "", `#series=${encodeURIComponent(series.id)}`);
    window.scrollTo({ top: 0 });
}

function closeSeriesView(updateHash = true) {
    seriesView.classList.add("hidden");
    catalogView.classList.remove("hidden");
    libraryHeader.classList.remove("hidden");
    document.body.classList.remove("series-route");
    currentOpenedSeries = null;
    currentOpenedEpisodes = [];
    if (updateHash) history.pushState({}, "", location.pathname);
}

function openSeriesFromHash() {
    const match = location.hash.match(/^#series=(\d+)/);
    if (match && (!currentOpenedSeries || String(currentOpenedSeries.id) !== match[1])) openSeries(match[1], false).catch(showError);
    else if (!match && !seriesView.classList.contains("hidden")) closeSeriesView(false);
}

async function toggleEpisodeCompleted(episode: LibraryEpisodeView, checkbox: HTMLInputElement) {
    checkbox.disabled = true;
    try {
        const { response, data } = await librarySetEpisodeCompleted(episode.id, checkbox.checked);
        if (!response.ok || data.error) throw new Error(data.error || lt("couldNotUpdateEpisodeStatus"));
        episode.completed = checkbox.checked;
        if (currentOpenedSeries) await openSeries(currentOpenedSeries.id, false);
        await loadLibrarySeries();
    } catch (error) { checkbox.checked = !checkbox.checked; showError(error); }
    finally { checkbox.disabled = false; }
}

async function deleteMissingEpisode(episode: LibraryEpisodeView) {
    if (!confirm(lt("deleteMissingEpisodeConfirm", { title: episode.title || lt("untitled") }))) return;
    const { response, data } = await libraryDeleteMissingEpisode(episode.id);
    if (!response.ok || data.error) throw new Error(data.error || lt("deleteMissingEpisodeFailed"));
    if (currentOpenedSeries) await openSeries(currentOpenedSeries.id, false);
    await loadLibrarySeries();
}

async function chooseLocalFolder(initialPath = "") {
    const { response, data } = await libraryChooseFolder(initialPath);
    if (!response.ok || data.error) throw new Error(data.error || lt("openFolderDialogFailed"));
    return data.cancelled || !data.path ? null : String(data.path);
}

async function startAndPollLibraryJob(requestPath: string, requestOptions: RequestInit = {}, failureMessage = lt("scanFailed")) {
    const { response, data } = await libraryStartJob(requestPath, requestOptions);
    if (!response.ok || data.error) throw new Error(data.error || failureMessage);
    const jobId = (data as LibraryJobData).job?.id;
    if (!jobId) return data;
    while (true) {
        const result = await libraryGetJobStatus(jobId);
        const job = (result.data as LibraryJobData).job;
        if (!result.response.ok || result.data.error) throw new Error(result.data.error || failureMessage);
        if (job?.status === "completed") return job.result;
        if (job?.status === "failed") throw new Error(job.error || job.result?.error || failureMessage);
        await sleep(700);
    }
}

async function addAnimeFromPath() {
    const path = await chooseLocalFolder();
    if (!path) return;
    await startAndPollLibraryJob("/library/scan-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }, lt("addAnimeFailed"));
    await loadLibrarySeries();
}

async function deleteSeriesFromLibrary(seriesId: string | number, title?: string) {
    if (!confirm(lt("deleteSeriesConfirm", { title: title || currentOpenedSeries?.title || lt("untitled") }))) return;
    const { response, data } = await libraryDeleteSeries(seriesId);
    if (!response.ok || data.error) throw new Error(data.error || lt("deleteSeriesFailed"));
    closeSeriesView();
    await loadLibrarySeries();
}

async function relinkCurrentSeriesFiles() {
    if (!currentOpenedSeries) return;
    const path = await chooseLocalFolder();
    if (!path) return;
    const { response, data } = await libraryRelinkSeries(currentOpenedSeries.id, { path });
    if (!response.ok || data.error) throw new Error(data.error || lt("relinkFailed"));
    await openSeries(currentOpenedSeries.id, false);
    await loadLibrarySeries();
}

function refreshCurrentSeriesLinkStatus() {
    if (!currentOpenedSeries) return;
    currentOpenedSeries.linkStatus = LibraryPresentation.linkStatus(currentOpenedEpisodes);
}

const subtitleController = createLibrarySubtitleController({ modal: subtitleModal, title: subtitleModalTitle, subtitle: subtitleModalSubtitle, searchInput: subtitleSearchInput, searchButton: subtitleSearchBtn, results: subtitleResults, getSeries: () => currentOpenedSeries, translate: lt, escapeHtml, formatBytes, search: librarySearchEpisodeSubtitles, select: librarySelectEpisodeSubtitle, refreshSeriesStatus: refreshCurrentSeriesLinkStatus, reportError: showError });
const openSubtitleSearchModal = subtitleController.open;
const closeSubtitleModal = subtitleController.close;
const searchSubtitlesForCurrentEpisode = subtitleController.search;
const coverController = createLibraryCoverController({ modal: coverModal, title: coverModalTitle, subtitle: coverModalSubtitle, searchInput: coverSearchInput, searchButton: coverSearchBtn, results: coverResults, translate: lt, escapeHtml, search: librarySearchSeriesCover, select: librarySelectSeriesCover, reload: async () => { await loadLibrarySeries(); if (currentOpenedSeries) await openSeries(currentOpenedSeries.id, false); }, reportError: showError });
const openCoverSearchModal = coverController.open;
const closeCoverModal = coverController.close;
const searchCoversForCurrentSeries = coverController.search;

function showError(error: unknown) { alert(error instanceof Error ? error.message : String(error)); }
