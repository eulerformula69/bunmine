function applyLibraryLanguage() {
    libraryCurrentLang = loadLibraryLanguage();
    document.documentElement.lang = libraryCurrentLang;
    document.title = lt("libraryTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = lt(key);
    });
    if (librarySummary?.textContent === "Loading..." || librarySummary?.textContent === "Загрузка..." || librarySummary?.textContent === "読み込み中...") librarySummary.textContent = lt("loading");
}

function watchedTextForEpisode(episode) {
    if (episode.completed) return lt("watched");
    if (episode.currentTimeSeconds > 0) return lt("atTime", { time: formatLibraryTime(episode.currentTimeSeconds) });
    return lt("notWatched");
}

const LINK_STATUS_ICON_PATHS = {
    linked: "/icons/chain-ok.svg",
    partial: "/icons/chain-missing.svg",
    missing: "/icons/chain-broken.svg",
};

function statusIconPath(status) {
    return LINK_STATUS_ICON_PATHS[status] || LINK_STATUS_ICON_PATHS.missing;
}

function renderSeriesTitle(series) {
    const status = series?.linkStatus || "missing";
    const title = series?.title || "";
    seriesTitle.innerHTML = `
        <img
            class="series-title-status-icon"
            src="${escapeHtml(statusIconPath(status))}"
            alt="${escapeHtml(statusTitle(status))}"
            title="${escapeHtml(statusTitle(status))}"
            data-series-link-status-icon
        >
        <span>${escapeHtml(title)}</span>
    `;
}

function recomputeSeriesLinkStatusFromEpisodes(episodes) {
    return LibraryPresentation.linkStatus(episodes);
}

function refreshCurrentSeriesLinkStatus() {
    if (!currentOpenedSeries) return;

    currentOpenedSeries.linkStatus = recomputeSeriesLinkStatusFromEpisodes(currentOpenedEpisodes);
    currentOpenedSeries.episodesWithVideo = currentOpenedEpisodes.filter((episode) => episode.hasVideo).length;
    currentOpenedSeries.episodesWithSubtitle = currentOpenedEpisodes.filter((episode) => episode.hasSubtitle).length;

    renderSeriesTitle(currentOpenedSeries);
    seriesStats.textContent = lt("seriesStats", {
        videos: currentOpenedSeries.episodesWithVideo,
        episodes: currentOpenedSeries.episodesCount,
        subtitles: currentOpenedSeries.episodesWithSubtitle,
        status: statusLabel(currentOpenedSeries.linkStatus)
    });
}

function statusLabel(status) {
    return LibraryPresentation.statusLabel(status, lt);
}

function statusKeyLabel(status) {
    return LibraryPresentation.planStatusLabel(status, lt);
}

const seriesGrid = document.getElementById("seriesGrid") as HTMLElement;
const librarySummary = document.getElementById("librarySummary") as HTMLElement;
const scanLibraryBtn = document.getElementById("scanLibraryBtn") as HTMLButtonElement;

const seriesModal = document.getElementById("seriesModal") as HTMLElement;
const seriesPanel = document.getElementById("seriesPanel") as HTMLElement;
const seriesTitle = document.getElementById("seriesTitle") as HTMLElement;
const seriesStats = document.getElementById("seriesStats") as HTMLElement;
const episodeList = document.getElementById("episodeList") as HTMLElement;
const closeSeriesPanelBtn = document.getElementById("closeSeriesPanelBtn") as HTMLButtonElement;

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

const changeSeriesCoverBtn = document.getElementById("changeSeriesCoverBtn") as HTMLButtonElement;
const downloadMissingSubtitlesBtn = document.getElementById("downloadMissingSubtitlesBtn") as HTMLButtonElement;
const relinkSeriesFilesBtn = document.getElementById("relinkSeriesFilesBtn") as HTMLButtonElement;
const deleteSeriesBtn = document.getElementById("deleteSeriesBtn") as HTMLButtonElement | null;
const bulkSubtitleModal = document.getElementById("bulkSubtitleModal") as HTMLElement;
const bulkSubtitleModalTitle = document.getElementById("bulkSubtitleModalTitle") as HTMLElement;
const bulkSubtitleModalSubtitle = document.getElementById("bulkSubtitleModalSubtitle") as HTMLElement;
const closeBulkSubtitleModalBtn = document.getElementById("closeBulkSubtitleModalBtn") as HTMLButtonElement;
const bulkSubtitleSearchInput = document.getElementById("bulkSubtitleSearchInput") as HTMLInputElement;
const bulkSubtitleSearchBtn = document.getElementById("bulkSubtitleSearchBtn") as HTMLButtonElement;
const bulkSubtitleStatus = document.getElementById("bulkSubtitleStatus") as HTMLElement;
const bulkSubtitleSets = document.getElementById("bulkSubtitleSets") as HTMLElement | null;
const bulkSubtitleList = document.getElementById("bulkSubtitleList") as HTMLElement;
const confirmBulkSubtitleDownloadBtn = document.getElementById("confirmBulkSubtitleDownloadBtn") as HTMLButtonElement;
const cancelBulkSubtitleDownloadBtn = document.getElementById("cancelBulkSubtitleDownloadBtn") as HTMLButtonElement;

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

function updateSeriesCompletedCount(seriesId, delta) {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".series-card"));

    for (const card of cards) {
        if (String(card.dataset.seriesId) !== String(seriesId)) continue;

        const completedEl = card.querySelector("[data-completed-episodes]");
        const totalEl = card.querySelector("[data-total-episodes]");
        const fillEl = card.querySelector<HTMLElement>(".progress-bar-fill");

        if (!completedEl || !totalEl) return;

        const currentCompleted = Number(completedEl.textContent || 0);
        const total = Number(totalEl.textContent || 0);
        const nextCompleted = Math.max(0, currentCompleted + delta);

        completedEl.textContent = String(nextCompleted);

        if (fillEl && total > 0) {
            fillEl.style.width = `${Math.round((nextCompleted / total) * 100)}%`;
        }

        return;
    }
}

function updateCurrentSeriesStatsText(delta) {
    if (!currentOpenedSeries) return;

    currentOpenedSeries.completedEpisodes = Math.max(
        0,
        Number(currentOpenedSeries.completedEpisodes || 0) + delta
    );
}

function formatLibraryTime(seconds) {
    return LibraryPresentation.formatTime(seconds);
}

function formatBytes(bytes) {
    return LibraryPresentation.formatBytes(bytes);
    }
function statusIcon(status) {
    if (status === "linked") return "✓";
    if (status === "partial") return "!";
    return "×";
}

function statusTitle(status) {
    if (status === "linked") return lt("allLinked");
    if (status === "partial") return lt("partiallyLinked");
    return lt("missingFiles");
}

function escapeHtml(value) {
    return LibraryPresentation.escapeHtml(value);
}

async function loadLibrarySeries() {
    seriesGrid.innerHTML = "";
    librarySummary.textContent = lt("loading");

    const { response, data } = await libraryListSeries();

    if (!response.ok || data.error) {
        throw new Error(data.error || lt("couldNotLoadLibrary"));
    }

    const series = (Array.isArray(data.series) ? data.series : []) as LibrarySeriesView[];

    const totalEpisodes = series.reduce((sum, item) => {
        return sum + Number(item.episodesCount || 0);
    }, 0);

    const completedEpisodes = series.reduce((sum, item) => {
        return sum + Number(item.completedEpisodes || 0);
    }, 0);

    const totalCards = series.reduce((sum, item) => {
        return sum + Number(item.cardsCount || 0);
    }, 0);

	librarySummary.textContent =
		lt("seriesSummary", { count: series.length, watched: completedEpisodes, total: totalEpisodes });

    seriesGrid.appendChild(renderAddAnimeCard());

    for (const item of series) {
        seriesGrid.appendChild(renderSeriesCard(item));
    }
}

function renderAddAnimeCard() {
    const card = document.createElement("article");
    card.className = "series-card add-anime-card";
    card.title = lt("addAnime");
    card.innerHTML = `
        <div class="series-cover add-anime-cover">
            <div class="add-anime-plus">+</div>
        </div>
        <div class="series-title">${escapeHtml(lt("addAnime"))}</div>
        <div class="series-extra">${escapeHtml(lt("addAnimeHint"))}</div>
    `;
    card.addEventListener("click", addAnimeFromPath);
    return card;
}

async function chooseLocalFolder(initialPath = "") {
    const { response, data } = await libraryChooseFolder(initialPath);

    if (!response.ok || data.error) {
        throw new Error(data.error || lt("openFolderDialogFailed"));
    }
    if (data.cancelled || !data.path) return null;
    return String(data.path);
}

async function startAndPollLibraryJob(requestPath, requestOptions = {}, failureMessage = lt("scanFailed")) {
    const { response, data } = await libraryStartJob(requestPath, requestOptions);
    const jobData = data as LibraryJobData;

    if (!response.ok || jobData.error) {
        throw new Error(jobData.error || failureMessage);
    }

    const jobId = jobData.job?.id;
    if (!jobId) {
        return jobData;
    }

    while (true) {
        const { response: statusResponse, data: statusData } = await libraryGetJobStatus(jobId);

        if (!statusResponse.ok || statusData.error) {
            throw new Error(statusData.error || failureMessage);
        }

        const statusJobData = statusData as LibraryJobData;
        const job = statusJobData.job || {};
        const result = job.result || {};

        if (job.status === "completed") {
            return result;
        }

        if (job.status === "failed") {
            throw new Error(job.error || result.error || failureMessage);
        }

        const found = Number(result.filesFound || 0);
        librarySummary.textContent = found
            ? `${lt("scanning")} ${found} files found...`
            : lt("scanning");

        await sleep(700);
    }
}

async function addAnimeFromPath() {
    let path = null;
    try {
        path = await chooseLocalFolder();
    } catch (err) {
        alert(`${lt("openFolderDialogFailed")}: ${err.message}`);
        return;
    }
    if (!path || !path.trim()) return;

    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");
    try {
        await startAndPollLibraryJob("/library/scan-path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path.trim() })
        }, lt("addAnimeFailed"));
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("addAnimeFailed")}: ${err.message}`);
    } finally {
        scanLibraryBtn.disabled = false;
        scanLibraryBtn.textContent = lt("scanLibrary");
    }
}

function renderSeriesCard(item) {
    const card = document.createElement("article");
    card.className = "series-card";
    card.title = item.title;
	card.dataset.seriesId = item.id;

    const progressPercent = item.episodesCount
        ? Math.round((item.completedEpisodes / item.episodesCount) * 100)
        : 0;

    const firstLetter = String(item.title || "?").trim().slice(0, 1).toUpperCase();

    const coverHtml = item.coverUrl
        ? `<img class="series-cover-image" src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}">`
        : `<div class="series-cover-letter">${escapeHtml(firstLetter)}</div>`;

    card.innerHTML = `
        <div class="series-cover">
            ${coverHtml}
        </div>

        <div class="series-title">${escapeHtml(item.title)}</div>

		<div class="series-meta">
			<span>
				<span data-completed-episodes>${escapeHtml(item.completedEpisodes)}</span>/<span data-total-episodes>${escapeHtml(item.episodesCount)}</span> ${escapeHtml(lt("eps"))}
			</span>
		</div>

		<div class="progress-bar">
			<div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
		</div>

    `;

		card.addEventListener("click", () => {
			openSeries(item.id);
		});

    return card;
}
async function openSeries(seriesId) {
    openSeriesModal();
    seriesTitle.textContent = lt("loading");
    seriesStats.textContent = "";
    episodeList.innerHTML = "";
    currentOpenedEpisodes = [];

    const { response, data } = await libraryGetSeries(seriesId);

    if (!response.ok || data.error) {
        seriesTitle.textContent = lt("error");
        seriesStats.textContent = data.error || lt("couldNotLoadSeries");
        return;
    }

    const series = data.series as LibrarySeriesView;
    const episodes = (Array.isArray(data.episodes) ? data.episodes : []) as LibraryEpisodeView[];
    currentOpenedEpisodes = episodes;
	currentOpenedSeries = {
		...series,
		completedEpisodes: episodes.filter((episode) => episode.completed).length
	};

    renderSeriesTitle(series);
    seriesStats.textContent =
        lt("seriesStats", { videos: series.episodesWithVideo, episodes: series.episodesCount, subtitles: series.episodesWithSubtitle, status: statusLabel(series.linkStatus) });

    episodeList.innerHTML = "";

    for (const episode of episodes) {
        episodeList.appendChild(renderEpisodeRow(episode));
    }
}

function renderEpisodeRow(episode) {
    const row = document.createElement("div");
    row.className = "episode-row";

    const canOpen = Boolean(episode.hasVideo);
    const canDelete = !episode.hasVideo && !episode.hasSubtitle;

    const watched = watchedTextForEpisode(episode);

	row.innerHTML = `
		<div>
			<label class="episode-title episode-title-checkbox">
				<input
					class="episode-completed-checkbox"
					type="checkbox"
					${episode.completed ? "checked" : ""}
					data-episode-id="${escapeHtml(episode.id)}"
				>
				<span>${escapeHtml(episode.title)}</span>
			</label>

            <div class="episode-meta">
                <span>${episode.hasVideo ? lt("videoYes") : lt("videoNo")}</span>
                <span>·</span>
                <span>${episode.hasSubtitle ? lt("subtitlesYes") : lt("subtitlesNo")}</span>
                <button
                    class="find-subtitles-btn find-subtitles-btn-inline"
                    type="button"
                    ${canOpen ? "" : "disabled"}
                    data-episode-id="${escapeHtml(episode.id)}"
                >
                    ${episode.hasSubtitle ? lt("changeJpSubs") : lt("findJpSubs")}
                </button>
                <span>·</span>
				<span data-episode-watched-text>${escapeHtml(watched)}</span>
            </div>
        </div>

        <div class="episode-actions">
            ${canDelete ? `
                <button class="delete-missing-episode-btn" type="button">
                    ${escapeHtml(lt("deleteMissingEpisode"))}
                </button>
            ` : ""}
            <a class="open-episode-link ${canOpen ? "" : "disabled"}"
               href="/?episodeId=${encodeURIComponent(episode.id)}">
                ${escapeHtml(lt("open"))}
            </a>
        </div>
    `;

	const completedCheckbox = row.querySelector(".episode-completed-checkbox") as HTMLInputElement;

	completedCheckbox.addEventListener("click", (event) => {
		event.stopPropagation();
	});

completedCheckbox.addEventListener("change", async () => {
    const previousValue = !completedCheckbox.checked;
    const nextValue = completedCheckbox.checked;

    completedCheckbox.disabled = true;

    try {
        const { response, data } = await librarySetEpisodeCompleted(episode.id, nextValue);

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotUpdateEpisodeStatus"));
        }

        const delta = nextValue ? 1 : -1;

        episode.completed = nextValue;
        updateCurrentSeriesStatsText(delta);
        updateSeriesCompletedCount(currentOpenedSeries?.id, delta);

        const watchedText = row.querySelector("[data-episode-watched-text]");
        if (watchedText) {
            watchedText.textContent = nextValue
                ? lt("watched")
                : episode.currentTimeSeconds > 0
                    ? lt("atTime", { time: formatLibraryTime(episode.currentTimeSeconds) })
                    : lt("notWatched");
        }
    } catch (err) {
        completedCheckbox.checked = previousValue;
        alert(err.message);
    } finally {
        completedCheckbox.disabled = false;
    }
});

    const findSubtitlesBtn = row.querySelector(".find-subtitles-btn") as HTMLButtonElement | null;
    if (findSubtitlesBtn) {
        findSubtitlesBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            openSubtitleSearchModal(episode, row);
        });
    }

    const deleteEpisodeBtn = row.querySelector(".delete-missing-episode-btn") as HTMLButtonElement | null;
    if (deleteEpisodeBtn) {
        deleteEpisodeBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            const confirmed = window.confirm(lt("deleteMissingEpisodeConfirm", {
                title: episode.title || lt("untitled")
            }));
            if (!confirmed || !currentOpenedSeries) return;

            deleteEpisodeBtn.disabled = true;
            try {
                const seriesId = currentOpenedSeries.id;
                const { response, data } = await libraryDeleteMissingEpisode(episode.id);
                if (!response.ok || data.error) {
                    throw new Error(data.error || lt("deleteMissingEpisodeFailed"));
                }

                await openSeries(seriesId);
                await loadLibrarySeries();
            } catch (err) {
                alert(`${lt("deleteMissingEpisodeFailed")}: ${err.message}`);
                deleteEpisodeBtn.disabled = false;
            }
        });
    }

    return row;
}

const subtitleController = createLibrarySubtitleController({
    modal: subtitleModal,
    title: subtitleModalTitle,
    subtitle: subtitleModalSubtitle,
    searchInput: subtitleSearchInput,
    searchButton: subtitleSearchBtn,
    results: subtitleResults,
    getSeries: () => currentOpenedSeries,
    translate: lt,
    escapeHtml,
    formatBytes,
    search: librarySearchEpisodeSubtitles,
    select: librarySelectEpisodeSubtitle,
    refreshSeriesStatus: refreshCurrentSeriesLinkStatus,
    reportError: (message) => alert(message),
});
const openSubtitleSearchModal = subtitleController.open;
const closeSubtitleModal = subtitleController.close;
const searchSubtitlesForCurrentEpisode = subtitleController.search;

const coverController = createLibraryCoverController({
    modal: coverModal,
    title: coverModalTitle,
    subtitle: coverModalSubtitle,
    searchInput: coverSearchInput,
    searchButton: coverSearchBtn,
    results: coverResults,
    translate: lt,
    escapeHtml,
    search: librarySearchSeriesCover,
    select: librarySelectSeriesCover,
    reload: loadLibrarySeries,
    reportError: (message) => alert(message),
});
const openCoverSearchModal = coverController.open;
const closeCoverModal = coverController.close;
const searchCoversForCurrentSeries = coverController.search;

async function deleteSeriesFromLibrary(seriesId, title) {
    const label = title || currentOpenedSeries?.title || lt("untitled");
    const ok = window.confirm(lt("deleteSeriesConfirm", { title: label }));
    if (!ok) return;

    if (deleteSeriesBtn) deleteSeriesBtn.disabled = true;
    try {
        const { response, data } = await libraryDeleteSeries(seriesId);
        if (!response.ok || data.error) throw new Error(data.error || lt("deleteSeriesFailed"));

        if (currentOpenedSeries && String(currentOpenedSeries.id) === String(seriesId)) {
            closeSeriesModal();
        }
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("deleteSeriesFailed")}: ${err.message}`);
    } finally {
        if (deleteSeriesBtn) deleteSeriesBtn.disabled = false;
    }
}


async function relinkCurrentSeriesFiles() {
    if (!currentOpenedSeries) return;

    let path = null;
    try {
        path = await chooseLocalFolder();
    } catch (err) {
        alert(`${lt("openFolderDialogFailed")}: ${err.message}`);
        return;
    }
    if (!path || !path.trim()) return;

    relinkSeriesFilesBtn.disabled = true;
    try {
        const { response, data } = await libraryRelinkSeries(currentOpenedSeries.id, { path: path.trim() });
        if (!response.ok || data.error) throw new Error(data.error || lt("relinkFailed"));
        seriesStats.textContent = lt("relinkDone", {
            count: Array.isArray(data.relinked) ? data.relinked.length : 0,
            unresolved: Array.isArray(data.unresolved) ? data.unresolved.length : 0
        });
        await openSeries(currentOpenedSeries.id);
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("relinkFailed")}: ${err.message}`);
    } finally {
        relinkSeriesFilesBtn.disabled = false;
    }
}
