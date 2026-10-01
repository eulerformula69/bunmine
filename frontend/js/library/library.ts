import { showToast, confirmToast } from "../core/notifications.js";
import { TranslationKey, isTranslationKey } from "../core/i18n.js";
import { escapeHtml, formatBytes, formatTime } from "../core/formatters.js";
import { safeWebUrl } from "../core/safe-url.js";
import { libraryCurrentLangState,loadLibraryLanguage,lt } from "./library-i18n.js";

import { LibraryEpisodeView,LibraryFilterState,LibraryJobData,LibrarySeriesFilter,LibrarySeriesSort,LibrarySeriesStatus,LibrarySeriesView } from "./library-types.js";

import { LibraryPresentation } from "./library-presentation.js";

import { currentOpenedEpisodesState,currentOpenedSeriesState,librarySeriesState } from "./library-state.js";

import { catalogEmpty,catalogResultSummary,catalogView,coverModal,coverModalSubtitle,coverModalTitle,coverResults,coverSearchBtn,coverSearchInput,episodeList,fileList,libraryFilters,libraryHeader,librarySummary,seriesCurrentEpisode,seriesDetailCover,seriesGrid,seriesPrimaryAction,seriesStats,seriesStatus,seriesTitle,seriesView,subtitleModal,subtitleModalSubtitle,subtitleModalTitle,subtitleResults,subtitleSearchBtn,subtitleSearchInput } from "./library-dom.js";

import { libraryChooseFolder,libraryDeleteMissingEpisode,libraryDeleteSeries,libraryGetJobStatus,libraryGetSeries,libraryListSeries,libraryRelinkSeries,librarySearchEpisodeSubtitles,librarySearchSeriesCover,librarySelectEpisodeSubtitle,librarySelectSeriesCover,librarySetEpisodeCompleted,libraryStartJob } from "./library-api.js";

import { sleep } from "../core/api.js";

import { createLibrarySubtitleController } from "./library-subtitle-controller.js";
import { pollLibraryJob } from "./job-polling.js";

import { createLibraryCoverController } from "./library-cover-controller.js";

export function applyLibraryLanguage() {
    libraryCurrentLangState.value = loadLibraryLanguage();
    document.documentElement.lang = libraryCurrentLangState.value;
    document.title = lt("libraryTitle");
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (key && isTranslationKey(key)) element.textContent = lt(key);
    });
    document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((element) => {
        const key = element.dataset.i18nPlaceholder || "";
        if (isTranslationKey(key)) element.placeholder = lt(key);
    });
}

export const LIBRARY_VIEW_STATE_KEY = "bunmineLibraryViewState";

export const VALID_FILTERS: LibrarySeriesFilter[] = ["all", "watching", "not-started", "completed", "missing-video", "missing-subtitles", "file-problems"];

export const VALID_SORTS: LibrarySeriesSort[] = ["last-watched", "progress", "title", "recently-added"];

export function loadLibraryViewState(): LibraryFilterState {
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

export function saveLibraryViewState() {
    localStorage.setItem(LIBRARY_VIEW_STATE_KEY, JSON.stringify({ filter: filterState.filter, sort: filterState.sort }));
}

export const filterState: LibraryFilterState = loadLibraryViewState();





export function statusLabel(status: LibrarySeriesStatus) { return lt(status === "not-started" ? "notStarted" : status); }

export function linkStatusIcon(status: string | undefined) {
    if (status === "linked") return "/icons/chain-ok.svg";
    if (status === "partial") return "/icons/chain-missing.svg";
    return "/icons/chain-broken.svg";
}

export function linkStatusTitle(status: string | undefined) {
    return lt(status === "linked" ? "allLinked" : status === "partial" ? "partiallyLinked" : "missingFiles");
}

export const FILTER_GROUPS: Array<{ label: TranslationKey; items: Array<[LibrarySeriesFilter, TranslationKey]> }> = [
    { label: "myLibrary", items: [["all", "all"], ["watching", "watching"], ["not-started", "notStarted"], ["completed", "completed"]] },
    { label: "files", items: [["missing-video", "missingVideo"], ["missing-subtitles", "missingSubtitles"], ["file-problems", "fileProblems"]] },
];

export const SORT_ITEMS: Array<[LibrarySeriesSort, TranslationKey]> = [["last-watched", "recentlyWatched"], ["progress", "byProgress"], ["title", "byTitle"], ["recently-added", "recentlyAdded"]];

export function filterCount(filter: LibrarySeriesFilter) {
    return librarySeriesState.value.filter((series) => LibraryPresentation.matchesFilter(series, filter)).length;
}

export function renderFilters() {
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

export function renderCatalog() {
    const visible = LibraryPresentation.filterAndSort([...librarySeriesState.value], filterState);
    seriesGrid.replaceChildren(...visible.map(renderSeriesCard));
    catalogEmpty.classList.toggle("hidden", visible.length > 0);
    catalogResultSummary.textContent = lt("showingSeries", { count: visible.length, total: librarySeriesState.value.length });
    renderFilters();
}

export function renderSeriesCard(item: LibrarySeriesView) {
    const card = document.createElement("article");
    card.className = "series-card";
    card.tabIndex = 0;
    card.dataset.seriesId = String(item.id);
    const total = Number(item.episodesCount || 0);
    const completed = Number(item.completedEpisodes || 0);
    const progress = total ? Math.round(completed / total * 100) : 0;
    const status = LibraryPresentation.seriesStatus(item);
    const cover = item.coverUrl
        ? `<img src="${escapeHtml(safeWebUrl(item.coverUrl))}" alt="">`
        : `<span class="cover-letter">${escapeHtml(String(item.title || "?").slice(0, 1))}</span>`;
    card.innerHTML = `<div class="series-cover">${cover}<span class="card-action">${escapeHtml(lt(status === "not-started" ? "startWatching" : status === "watching" ? "continueWatching" : "open"))}</span></div><div class="series-card-body"><h3>${escapeHtml(item.title)}</h3><p class="series-state">${escapeHtml(statusLabel(status))} · <span data-completed-episodes>${completed}</span>/<span data-total-episodes>${total}</span></p><div class="progress-bar"><span style="width:${progress}%"></span></div>${Number(item.currentTimeSeconds || 0) > 5 && status === "watching" ? `<p class="continue-note">${escapeHtml(lt("continueAt", { time: formatTime(item.currentTimeSeconds, "duration") }))}</p>` : ""}</div>`;
    const open = () => openSeries(item.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
    return card;
}

export async function loadLibrarySeries() {
    librarySummary.textContent = lt("loading");
    const { response, data } = await libraryListSeries();
    if (!response.ok || data.error) throw new Error(String(data.error || lt("couldNotLoadLibrary")));
    librarySeriesState.value = (Array.isArray(data.series) ? data.series : []) as LibrarySeriesView[];
    const total = librarySeriesState.value.reduce((sum, item) => sum + Number(item.episodesCount || 0), 0);
    const watched = librarySeriesState.value.reduce((sum, item) => sum + Number(item.completedEpisodes || 0), 0);
    librarySummary.textContent = lt("seriesSummary", { count: librarySeriesState.value.length, watched, total });
    renderCatalog();
    openSeriesFromHash();
}

export function episodeNumber(episode: LibraryEpisodeView) {
    return episode.episodeNumber ?? episode.title ?? "—";
}

export function episodeState(episode: LibraryEpisodeView) {
    if (episode.completed) return lt("watched");
    if (Number(episode.currentTimeSeconds || 0) > 5) return lt("inProgress");
    return lt("notWatched");
}

export function renderEpisodeRow(episode: LibraryEpisodeView) {
    const row = document.createElement("article");
    row.className = `episode-row${episode.hasVideo ? " clickable" : ""}`;
    const canResume = LibraryPresentation.episodeCanResume(episode);
    const action = canResume ? lt("continueWatching") : lt("open");
    row.innerHTML = `<div class="episode-number">${escapeHtml(episodeNumber(episode))}</div><div class="episode-main"><h3>${escapeHtml(episode.title || lt("episodeLabel", { number: episodeNumber(episode) }))}</h3><p><span class="episode-state">${escapeHtml(episodeState(episode))}</span>${canResume ? ` · ${escapeHtml(formatTime(episode.currentTimeSeconds, "duration"))} / ${escapeHtml(formatTime(episode.durationSeconds, "duration"))}` : ""}${!episode.hasSubtitle ? ` · ${escapeHtml(lt("noJp"))}` : ""}${!episode.hasVideo ? ` · ${escapeHtml(lt("missingVideo"))}` : ""}</p></div><div class="episode-actions"><label class="complete-toggle"><input class="episode-completed-checkbox" type="checkbox" ${episode.completed ? "checked" : ""}><span>${escapeHtml(lt("watched"))}</span></label><a class="button small ${episode.hasVideo ? "primary" : "disabled"}" href="/?episodeId=${encodeURIComponent(episode.id)}">${escapeHtml(action)}</a></div>`;
    const checkbox = row.querySelector<HTMLInputElement>("input")!;
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => toggleEpisodeCompleted(episode, checkbox));
    if (episode.hasVideo) row.addEventListener("click", (event) => { if (!(event.target as HTMLElement).closest("a,label,button")) location.href = `/?episodeId=${encodeURIComponent(episode.id)}`; });
    return row;
}

export function renderFileRow(episode: LibraryEpisodeView) {
    const row = document.createElement("article");
    row.className = "file-row";
    row.innerHTML = `<div><h3>${escapeHtml(lt("episodeLabel", { number: episodeNumber(episode) }))}</h3><p>${escapeHtml(episode.videoFilename || lt("missingVideo"))}</p><p class="subtitle-filename">${escapeHtml(episode.subtitleFilename || lt("missingSubtitles"))}</p></div><div class="file-actions"><button class="button small subtitle-file-action" type="button" ${episode.hasVideo ? "" : "disabled"}>${escapeHtml(episode.hasSubtitle ? lt("changeJpSubs") : lt("findJpSubs"))}</button>${!episode.hasVideo && !episode.hasSubtitle ? `<button class="button small danger delete-missing-episode-btn" type="button">${escapeHtml(lt("deleteMissingEpisode"))}</button>` : ""}</div>`;
    row.querySelector<HTMLButtonElement>(".subtitle-file-action")?.addEventListener("click", () => subtitleController.open(episode, row));
    row.querySelector<HTMLButtonElement>(".delete-missing-episode-btn")?.addEventListener("click", () => deleteMissingEpisode(episode));
    return row;
}

export async function openSeries(seriesId: string | number, updateHash = true) {
    catalogView.classList.add("hidden");
    seriesView.classList.remove("hidden");
    libraryHeader.classList.add("hidden");
    document.body.classList.add("series-route");
    seriesTitle.textContent = lt("loading");
    episodeList.replaceChildren();
    fileList.replaceChildren();
    const { response, data } = await libraryGetSeries(seriesId);
    if (!response.ok || data.error || !data.series) throw new Error(String(data.error || lt("couldNotLoadSeries")));
    currentOpenedEpisodesState.value = (data.episodes || []) as LibraryEpisodeView[];
    currentOpenedSeriesState.value = { ...(data.series as LibrarySeriesView), completedEpisodes: currentOpenedEpisodesState.value.filter((item) => item.completed).length };
    const series = currentOpenedSeriesState.value;
    const status = LibraryPresentation.seriesStatus(series);
    const primary = LibraryPresentation.primaryAction(series, currentOpenedEpisodesState.value);
    const current = currentOpenedEpisodesState.value.find((item) => !item.completed && Number(item.currentTimeSeconds || 0) > 5) || currentOpenedEpisodesState.value.find((item) => !item.completed);
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
    seriesDetailCover.innerHTML = series.coverUrl ? `<img src="${escapeHtml(safeWebUrl(series.coverUrl))}" alt="">` : `<span class="cover-letter">${escapeHtml(series.title.slice(0, 1))}</span>`;
    episodeList.replaceChildren(...currentOpenedEpisodesState.value.map(renderEpisodeRow));
    fileList.replaceChildren(...currentOpenedEpisodesState.value.map(renderFileRow));
    if (updateHash) history.pushState({ seriesId: series.id }, "", `#series=${encodeURIComponent(series.id)}`);
    window.scrollTo({ top: 0 });
}

export function closeSeriesView(updateHash = true) {
    seriesView.classList.add("hidden");
    catalogView.classList.remove("hidden");
    libraryHeader.classList.remove("hidden");
    document.body.classList.remove("series-route");
    currentOpenedSeriesState.value = null;
    currentOpenedEpisodesState.value = [];
    if (updateHash) history.pushState({}, "", location.pathname);
}

export function openSeriesFromHash() {
    const match = location.hash.match(/^#series=(\d+)/);
    if (match && (!currentOpenedSeriesState.value || String(currentOpenedSeriesState.value.id) !== match[1])) openSeries(match[1], false).catch(showError);
    else if (!match && !seriesView.classList.contains("hidden")) closeSeriesView(false);
}

export async function toggleEpisodeCompleted(episode: LibraryEpisodeView, checkbox: HTMLInputElement) {
    checkbox.disabled = true;
    try {
        const { response, data } = await librarySetEpisodeCompleted(episode.id, checkbox.checked);
        if (!response.ok || data.error) throw new Error(String(data.error || lt("couldNotUpdateEpisodeStatus")));
        episode.completed = checkbox.checked;
        if (currentOpenedSeriesState.value) await openSeries(currentOpenedSeriesState.value.id, false);
        await loadLibrarySeries();
    } catch (error) { checkbox.checked = !checkbox.checked; showError(error); }
    finally { checkbox.disabled = false; }
}

export async function deleteMissingEpisode(episode: LibraryEpisodeView) {
    if (!await confirmToast(lt("deleteMissingEpisodeConfirm", { title: episode.title || lt("untitled") }), lt("deleteMissingEpisode"), lt("cancel"))) return;
    const { response, data } = await libraryDeleteMissingEpisode(episode.id);
    if (!response.ok || data.error) throw new Error(String(data.error || lt("deleteMissingEpisodeFailed")));
    if (currentOpenedSeriesState.value) await openSeries(currentOpenedSeriesState.value.id, false);
    await loadLibrarySeries();
}

export async function chooseLocalFolder(initialPath = "") {
    const { response, data } = await libraryChooseFolder(initialPath);
    if (!response.ok || data.error) throw new Error(String(data.error || "openFolderDialogFailed"));
    return data.cancelled || !data.path ? null : String(data.path);
}

export async function startAndPollLibraryJob(requestPath: string, requestOptions: RequestInit = {}, failureMessage = lt("scanFailed")) {
    const { response, data } = await libraryStartJob(requestPath, requestOptions);
    if (!response.ok || data.error) throw new Error(String(data.error || failureMessage));
    const jobId = (data as LibraryJobData).job?.id;
    if (!jobId) return data;
    return pollLibraryJob(jobId, {failureMessage, signal: requestOptions.signal || undefined});
}

export async function addAnimeFromPath() {
    const path = await chooseLocalFolder();
    if (!path) return;
    await startAndPollLibraryJob("/library/scan-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }, lt("addAnimeFailed"));
    await loadLibrarySeries();
}

export async function deleteSeriesFromLibrary(seriesId: string | number, title?: string) {
    if (!await confirmToast(lt("deleteSeriesConfirm", { title: title || currentOpenedSeriesState.value?.title || lt("untitled") }), lt("deleteSeries"), lt("cancel"))) return;
    const { response, data } = await libraryDeleteSeries(seriesId);
    if (!response.ok || data.error) throw new Error(String(data.error || lt("deleteSeriesFailed")));
    closeSeriesView();
    await loadLibrarySeries();
}

export async function relinkCurrentSeriesFiles() {
    if (!currentOpenedSeriesState.value) return;
    const path = await chooseLocalFolder();
    if (!path) return;
    const { response, data } = await libraryRelinkSeries(currentOpenedSeriesState.value.id, { path });
    if (!response.ok || data.error) throw new Error(String(data.error || lt("relinkFailed")));
    await openSeries(currentOpenedSeriesState.value.id, false);
    await loadLibrarySeries();
}

export function refreshCurrentSeriesLinkStatus() {
    if (!currentOpenedSeriesState.value) return;
    currentOpenedSeriesState.value.linkStatus = LibraryPresentation.linkStatus(currentOpenedEpisodesState.value);
}

export const subtitleController = createLibrarySubtitleController({ modal: subtitleModal, title: subtitleModalTitle, subtitle: subtitleModalSubtitle, searchInput: subtitleSearchInput, searchButton: subtitleSearchBtn, results: subtitleResults, getSeries: () => currentOpenedSeriesState.value, translate: lt, escapeHtml, formatBytes, search: librarySearchEpisodeSubtitles, select: librarySelectEpisodeSubtitle, refreshSeriesStatus: refreshCurrentSeriesLinkStatus, reportError: showError });




export const coverController = createLibraryCoverController({ modal: coverModal, title: coverModalTitle, subtitle: coverModalSubtitle, searchInput: coverSearchInput, searchButton: coverSearchBtn, results: coverResults, translate: lt, escapeHtml, search: librarySearchSeriesCover, select: librarySelectSeriesCover, reload: async () => { await loadLibrarySeries(); if (currentOpenedSeriesState.value) await openSeries(currentOpenedSeriesState.value.id, false); }, reportError: showError });




export function showError(error: unknown) { showToast(error instanceof Error ? error.message : String(error), "error", 6000); }
