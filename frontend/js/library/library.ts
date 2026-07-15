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

let currentCoverSeries: LibrarySeriesView | null = null;
let currentSubtitleEpisode: SubtitleEpisodeSelection | null = null;
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

function openSubtitleModal() {
    subtitleModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeSubtitleModal() {
    subtitleModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentSubtitleEpisode = null;
}

async function openSubtitleSearchModal(episode: LibraryEpisodeView, row: HTMLElement) {
    if (!currentOpenedSeries) return;

    currentSubtitleEpisode = { episode, row };

    const episodeNumber = episode.episodeNumber ?? "?";
    subtitleModalTitle.textContent = episode.hasSubtitle ? lt("changeJapaneseSubtitles") : lt("findJapaneseSubtitles");
    subtitleModalSubtitle.textContent = `${currentOpenedSeries.title} · ${lt("episodeLabel", { number: episodeNumber })}`;
    subtitleSearchInput.value = currentOpenedSeries.title;
    subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("subtitleQueryHint"))}</div>`;

    openSubtitleModal();
    subtitleSearchInput.focus();
    subtitleSearchInput.select();
}

async function searchSubtitlesForCurrentEpisode() {
    if (!currentSubtitleEpisode) return;

    const { episode } = currentSubtitleEpisode;
    const query = subtitleSearchInput.value.trim() || currentOpenedSeries?.title || "";

    subtitleSearchBtn.disabled = true;
    subtitleSearchBtn.textContent = lt("searching");
    subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("searchingJimaku"))}</div>`;

    try {
        const { response, data } = await librarySearchEpisodeSubtitles(episode.id, query);

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("subtitleSearchFailed"));
        }

        renderSubtitleResults(data.results || []);
    } catch (err) {
        subtitleResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        subtitleSearchBtn.disabled = false;
        subtitleSearchBtn.textContent = lt("search");
    }
}

function renderSubtitleResults(results) {
    subtitleResults.innerHTML = "";

    if (!results.length) {
        subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("noDirectSubtitles"))}</div>`;
        return;
    }

    for (const result of results) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "subtitle-result-item";

        const meta = [
            result.entryTitle,
            result.extension,
            formatBytes(result.sizeBytes),
            result.lastModified ? String(result.lastModified).slice(0, 10) : null,
        ].filter(Boolean).join(" · ");

        item.innerHTML = `
            <div class="cover-result-info">
                <div class="cover-result-title">${escapeHtml(result.filename || lt("untitledSubtitle"))}</div>
                <div class="cover-result-meta">${escapeHtml(meta)}</div>
            </div>
        `;

        item.addEventListener("click", () => {
            selectSubtitleResult(result);
        });

        subtitleResults.appendChild(item);
    }
}

async function selectSubtitleResult(result) {
    if (!currentSubtitleEpisode) return;

    const { episode, row } = currentSubtitleEpisode;
    subtitleResults.classList.add("is-loading");

    try {
        const { response, data } = await librarySelectEpisodeSubtitle(episode.id, {
            source: result.source,
            entryId: result.entryId,
            filename: result.filename,
            downloadUrl: result.downloadUrl
        });

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotSaveSubtitle"));
        }

        episode.hasSubtitle = true;
        episode.subtitleFileId = (data as LibraryMutationResponse & { subtitleFileId?: number | null }).subtitleFileId;
        episode.linkStatus = episode.hasVideo ? "linked" : "partial";

        const meta = row.querySelector(".episode-meta");
        if (meta) {
            const watchedText = row.querySelector("[data-episode-watched-text]")?.outerHTML || "";
            meta.innerHTML = `${episode.hasVideo ? lt("videoYes") : lt("videoNo")} <span>·</span> <span>${lt("subtitlesYes")}</span> <button class="find-subtitles-btn find-subtitles-btn-inline" type="button" ${episode.hasVideo ? "" : "disabled"} data-episode-id="${escapeHtml(episode.id)}">${lt("changeJpSubs")}</button> <span>·</span> ${watchedText}`;
        }

        const btn = row.querySelector(".find-subtitles-btn");
        if (btn) btn.textContent = lt("changeJpSubs");

        refreshCurrentSeriesLinkStatus();

        closeSubtitleModal();
    } catch (err) {
        alert(err.message);
    } finally {
        subtitleResults.classList.remove("is-loading");
    }
}

function openBulkSubtitleModal() {
    bulkSubtitleModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeBulkSubtitleModal() {
    if (isBulkSubtitleDownloading || isBulkSubtitlePreparing) return;
    bulkSubtitleModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    bulkSubtitleStatus.textContent = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
}

async function prepareMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeries) return;

    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    bulkSubtitleModalTitle.textContent = lt("downloadMissingJapaneseSubtitles");
    bulkSubtitleModalSubtitle.textContent = currentOpenedSeries.title;
    bulkSubtitleSearchInput.value = currentOpenedSeries.title;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("subtitleQueryHint");
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
    openBulkSubtitleModal();
    bulkSubtitleSearchInput.focus();
    bulkSubtitleSearchInput.select();
}

async function analyzeMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeries || isBulkSubtitlePreparing || isBulkSubtitleDownloading) return;

    const query = bulkSubtitleSearchInput.value.trim() || currentOpenedSeries.title;
    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("analyzingJimakuEntries");
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;

    const previousText = downloadMissingSubtitlesBtn.textContent;
    const previousSearchText = bulkSubtitleSearchBtn.textContent;
    downloadMissingSubtitlesBtn.disabled = true;
    bulkSubtitleSearchBtn.disabled = true;
    bulkSubtitleSearchBtn.textContent = lt("searching");
    downloadMissingSubtitlesBtn.textContent = lt("analyzing");
    isBulkSubtitlePreparing = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;

    try {
        const data = await requestSeriesSubtitleAnalysisWithBackoff(currentOpenedSeries.id, query);
        currentBulkSubtitlePlan = data;
        renderBulkSubtitlePlan(data);

        const selectable = (data.items || []).filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
        const skipped = (data.items || []).filter((item) => item.status === "skipped").length;
        bulkSubtitleStatus.textContent = selectable
            ? lt("analysisReadyChoose", { selectable, skipped, entries: data.entriesChecked || 0 })
            : lt("analysisReadyNone", { skipped, entries: data.entriesChecked || 0 });
    } catch (err) {
        bulkSubtitleStatus.classList.add("error");
        bulkSubtitleStatus.textContent = err.message;
    } finally {
        isBulkSubtitlePreparing = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        downloadMissingSubtitlesBtn.disabled = false;
        bulkSubtitleSearchBtn.disabled = false;
        bulkSubtitleSearchBtn.textContent = previousSearchText;
        downloadMissingSubtitlesBtn.textContent = previousText;
        renderBulkSubtitlePlan(currentBulkSubtitlePlan || { items: [] });
        updateBulkSubtitleConfirmState();
    }
}

async function requestSeriesSubtitleAnalysisWithBackoff(seriesId, query): Promise<BulkSubtitlePlan> {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await libraryAnalyzeSeriesSubtitles(seriesId, query);

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotAnalyzeJimaku"));
            }
            return data as BulkSubtitlePlan;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        bulkSubtitleStatus.textContent = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

function retryAfterToMs(value) {
    const raw = String(value || "").trim();
    if (!raw) return JIMAKU_429_DEFAULT_WAIT_MS;

    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
        return Math.max(1000, asNumber * 1000);
    }

    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate)) {
        return Math.max(1000, asDate - Date.now());
    }

    return JIMAKU_429_DEFAULT_WAIT_MS;
}

function updateBulkSubtitleConfirmState() {
    if (isBulkSubtitlePreparing || isBulkSubtitleDownloading || !currentBulkSubtitlePlan) {
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }
    confirmBulkSubtitleDownloadBtn.disabled = getSelectedBulkSubtitleItems().length === 0;
}

function candidateKey(candidate) {
    return LibraryBulkModel.candidateKey(candidate);
}

function formatSubtitleCandidate(candidate) {
    return LibraryBulkModel.formatCandidate(candidate, formatBytes);
}

function getBulkSubtitleSets(plan) {
    return LibraryBulkModel.getSets(plan, lt);
}

function renderBulkSubtitleSets(plan) {
    if (!bulkSubtitleSets) return;

    const items = Array.isArray(plan?.items) ? plan.items : [];
    const hasPending = items.some((item) => ["pending", "searching", "rate-limited"].includes(item.status));
    const sets = getBulkSubtitleSets(plan);

    bulkSubtitleSets.innerHTML = "";

    if (!sets.length) {
        if (!hasPending) {
            bulkSubtitleSets.innerHTML = `<div class="cover-message">${escapeHtml(lt("noSubtitleSets"))}</div>`;
        }
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "bulk-subtitle-sets-inner";

    const title = document.createElement("div");
    title.className = "bulk-subtitle-sets-title";
    title.textContent = hasPending
        ? lt("suggestedSetsFoundSoFar")
        : lt("chooseSetBeforeDownloading");
    wrapper.appendChild(title);

    const list = document.createElement("div");
    list.className = "bulk-subtitle-set-list";

    for (const set of sets.slice(0, 8)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bulk-subtitle-set-btn ${currentBulkSubtitleSetKey === set.key ? "selected" : ""}`;
        button.disabled = isBulkSubtitleDownloading;
        button.dataset.releaseKey = set.key;
        button.innerHTML = `
            <div class="bulk-subtitle-set-name">${escapeHtml(set.label)}</div>
            <div class="bulk-subtitle-set-count">${escapeHtml(set.count)} / ${escapeHtml(set.totalEpisodes)} episodes</div>
            <div class="bulk-subtitle-set-examples">${escapeHtml(set.examples.join(" · "))}</div>
        `;
        list.appendChild(button);
    }

    wrapper.appendChild(list);
    bulkSubtitleSets.appendChild(wrapper);
}

function applyBulkSubtitleSet(releaseKey) {
    if (!currentBulkSubtitlePlan) return;
    currentBulkSubtitleSetKey = releaseKey;
    LibraryBulkModel.applySet(currentBulkSubtitlePlan, releaseKey, lt);
    renderBulkSubtitlePlan(currentBulkSubtitlePlan);
}

async function requestEpisodeSubtitlePlanWithBackoff(item) {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await libraryPlanEpisodeSubtitle(item.episodeId, currentOpenedSeries.title);

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotSearchEpisodeJimaku"));
            }
            return data.item;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        item.status = "rate-limited";
        item.message = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

async function prepareBulkSubtitlePlanGradually(plan) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    if (!items.length) {
        bulkSubtitleStatus.textContent = lt("noMissingSubtitleEpisodes");
        return;
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        item.status = "searching";
        item.message = lt("searchingEpisodeJimaku");
        renderBulkSubtitlePlan(plan);
        bulkSubtitleStatus.textContent = lt("searchingJimakuProgress", { current: index + 1, total: items.length, episode: item.episodeNumber ?? "?" });

        try {
            const plannedItem = await requestEpisodeSubtitlePlanWithBackoff(item);
            Object.assign(item, plannedItem);
            if (currentBulkSubtitleSetKey) {
                const candidates = Array.isArray(item.candidates) ? item.candidates : [];
                const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(currentBulkSubtitleSetKey));
                if (candidate) {
                    item.selected = candidate;
                    item.status = "ready";
                    item.message = lt("selectedFromSubtitleSet");
                }
            }
        } catch (err) {
            item.status = "failed";
            item.message = err.message;
            item.selected = null;
            item.candidates = [];
            item.alternativesCount = 0;
        }

        renderBulkSubtitlePlan(plan);

        if (index < items.length - 1) {
            await sleep(JIMAKU_PLAN_REQUEST_DELAY_MS);
        }
    }

    const selectable = items.filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
    const selected = items.filter((item) => item.status === "ready" && item.selected).length;
    const skipped = items.filter((item) => item.status === "skipped").length;
    const failed = items.filter((item) => item.status === "failed").length;
    bulkSubtitleStatus.textContent = selected
        ? lt("planReadySelected", { selected, review: selectable - selected, skipped, failed })
        : lt("planReadyChoose", { selectable, skipped, failed });
    updateBulkSubtitleConfirmState();
}

function renderBulkSubtitlePlan(plan) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    const readyItems = items.filter((item) => item.status === "ready" && item.selected);
    const reviewItems = items.filter((item) => item.status === "needs-review" || (Array.isArray(item.candidates) && item.candidates.length && !item.selected));
    const skippedItems = items.filter((item) => item.status === "skipped");
    const failedItems = items.filter((item) => item.status === "failed");
    const pendingItems = items.filter((item) => ["pending", "searching", "rate-limited"].includes(item.status));

    bulkSubtitleStatus.classList.remove("error");
    if (!isBulkSubtitlePreparing && !isBulkSubtitleDownloading) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusReady", { selected: readyItems.length, review: reviewItems.length, skipped: skippedItems.length, failed: failedItems.length });
    } else if (pendingItems.length) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusChecking", { selected: readyItems.length, pending: pendingItems.length, failed: failedItems.length });
    }

    renderBulkSubtitleSets(plan);
    bulkSubtitleList.innerHTML = "";

    if (!items.length) {
        bulkSubtitleList.innerHTML = `<div class="cover-message">${escapeHtml(lt("noMissingSubtitleEpisodes"))}</div>`;
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }

    for (const item of items) {
        const row = document.createElement("div");
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const selected = item.selected || null;
        const canDownload = item.status === "ready" && selected?.downloadUrl;
        const hasManualChoices = candidates.length > 0 && !isBulkSubtitlePreparing && !isBulkSubtitleDownloading;
        const meta = canDownload
            ? formatSubtitleCandidate(selected)
            : candidates.length
                ? item.message || lt("chooseSubtitleSetOrManual")
                : item.message || lt("noSubtitleSelected");

        row.className = `bulk-subtitle-item ${escapeHtml(item.status || "skipped")}`;
        row.innerHTML = `
            <input
                class="bulk-subtitle-checkbox"
                type="checkbox"
                ${canDownload ? "checked" : "disabled"}
                ${isBulkSubtitlePreparing || isBulkSubtitleDownloading ? "disabled" : ""}
                data-episode-id="${escapeHtml(item.episodeId)}"
            >
            <div class="bulk-subtitle-info">
                <div class="bulk-subtitle-title">
                    ${escapeHtml(lt("episodeLabel", { number: item.episodeNumber ?? "?" }))} · ${escapeHtml(item.episodeTitle || lt("untitled"))}
                </div>
                <div class="bulk-subtitle-meta">${escapeHtml(meta)}</div>
                ${hasManualChoices ? `
                    <select class="bulk-subtitle-select" data-episode-id="${escapeHtml(item.episodeId)}">
                        <option value="">${escapeHtml(lt("chooseManually"))}</option>
                        ${candidates.map((candidate) => `
                            <option value="${escapeHtml(candidateKey(candidate))}" ${selected && candidateKey(candidate) === candidateKey(selected) ? "selected" : ""}>
                                ${escapeHtml(candidate.releaseLabel || candidate.entryTitle || lt("other"))} — ${escapeHtml(candidate.filename || lt("subtitle"))}
                            </option>
                        `).join("")}
                    </select>
                ` : ""}
            </div>
            <div class="bulk-subtitle-state" data-bulk-state-for="${escapeHtml(item.episodeId)}">
                ${escapeHtml(canDownload ? lt("ready") : statusKeyLabel(item.status))}
            </div>
        `;

        bulkSubtitleList.appendChild(row);
    }

    updateBulkSubtitleConfirmState();
}

function getSelectedBulkSubtitleItems() {
    if (!currentBulkSubtitlePlan) return [];

    const selectedIds = new Set(
        Array.from(bulkSubtitleList.querySelectorAll<HTMLInputElement>(".bulk-subtitle-checkbox:checked"))
            .map((checkbox) => String(checkbox.dataset.episodeId))
    );

    return (currentBulkSubtitlePlan.items || []).filter((item) => {
        return item.status === "ready" && item.selected && selectedIds.has(String(item.episodeId));
    });
}

async function postSubtitleDownloadWithBackoff(item) {
    const selected = item.selected;

    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await librarySelectEpisodeSubtitle(item.episodeId, {
            source: selected.source,
            entryId: selected.entryId,
            filename: selected.filename,
            downloadUrl: selected.downloadUrl
        });

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotSaveSubtitle"));
            }
            return data;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);
        if (stateEl) stateEl.textContent = lt("rateLimitedRetrying", { seconds: Math.ceil(waitMs / 1000) });
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

async function downloadSelectedBulkSubtitles() {
    const items = getSelectedBulkSubtitleItems();
    if (!items.length) return;

    isBulkSubtitleDownloading = true;
    confirmBulkSubtitleDownloadBtn.disabled = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;
    bulkSubtitleList.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((input) => {
        input.disabled = true;
    });

    let downloaded = 0;
    let failed = 0;
    let nextIndex = 0;

    async function worker(workerId) {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            const item = items[index];
            const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);

            bulkSubtitleStatus.textContent = lt("downloadingProgress", { done: downloaded + failed, total: items.length, concurrency: Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length) });
            if (stateEl) stateEl.textContent = lt("downloadingState");

            try {
                await postSubtitleDownloadWithBackoff(item);
                downloaded += 1;
                if (stateEl) stateEl.textContent = lt("downloadedState");
            } catch (err) {
                failed += 1;
                if (stateEl) stateEl.textContent = lt("failedState", { message: err.message });
            }

            bulkSubtitleStatus.textContent = lt("downloadingSummary", { done: downloaded + failed, total: items.length, downloaded, failed });
        }
    }

    try {
        const workerCount = Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length);
        await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));
        bulkSubtitleStatus.textContent = lt("finishedDownloads", { downloaded, failed });
        await openSeries(currentOpenedSeries.id);
        await loadLibrarySeries();
    } finally {
        isBulkSubtitleDownloading = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        confirmBulkSubtitleDownloadBtn.disabled = true;
    }
}




function openCoverModal() {
    coverModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeCoverModal() {
    coverModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentCoverSeries = null;
}

async function openCoverSearchModal(series) {
    currentCoverSeries = series;

    coverModalTitle.textContent = series.coverUrl ? lt("changeCover") : lt("findCover");
    coverModalSubtitle.textContent = series.title;
    coverSearchInput.value = series.title;
    coverResults.innerHTML = "";

    openCoverModal();

    await searchCoversForCurrentSeries();
}

async function searchCoversForCurrentSeries() {
    if (!currentCoverSeries) return;

    const query = coverSearchInput.value.trim() || currentCoverSeries.title;

    coverSearchBtn.disabled = true;
    coverSearchBtn.textContent = lt("searching");
    coverResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("searchingAniList"))}</div>`;

    try {
        const { response, data } = await librarySearchSeriesCover(currentCoverSeries.id, query);

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("coverSearchFailed"));
        }

        renderCoverResults(data.results || []);
    } catch (err) {
        coverResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        coverSearchBtn.disabled = false;
        coverSearchBtn.textContent = lt("search");
    }
}

function renderCoverResults(results) {
    coverResults.innerHTML = "";

    if (!results.length) {
        coverResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("noResultsFound"))}</div>`;
        return;
    }

    for (const result of results) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cover-result-item";

        const meta = [
            result.format,
            result.seasonYear,
            result.episodes ? `${result.episodes} ${lt("eps")}` : null,
        ].filter(Boolean).join(" · ");

        item.innerHTML = `
            <img src="${escapeHtml(result.coverUrl)}" alt="">
            <div class="cover-result-info">
                <div class="cover-result-title">${escapeHtml(result.title || result.preferredTitle || lt("untitled"))}</div>
                <div class="cover-result-subtitle">${escapeHtml(result.englishTitle || result.nativeTitle || "")}</div>
                <div class="cover-result-meta">${escapeHtml(meta)}</div>
            </div>
        `;

        item.addEventListener("click", () => {
            selectCoverResult(result);
        });

        coverResults.appendChild(item);
    }
}

async function selectCoverResult(result) {
    if (!currentCoverSeries) return;

    coverResults.classList.add("is-loading");

    try {
        const { response, data } = await librarySelectSeriesCover(currentCoverSeries.id, {
            source: result.source,
            externalId: result.externalId,
            coverUrl: result.coverUrl
        });

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotSaveCover"));
        }

        closeCoverModal();
        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        coverResults.classList.remove("is-loading");
    }
}


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


scanLibraryBtn.addEventListener("click", async () => {
    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");

    try {
        await startAndPollLibraryJob("/library/scan", {}, lt("scanFailed"));
        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        scanLibraryBtn.disabled = false;
        scanLibraryBtn.textContent = lt("scanLibrary");
    }
});

closeSeriesPanelBtn.addEventListener("click", () => {
    closeSeriesModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeSeriesModal();
        closeCoverModal();
        closeSubtitleModal();
        closeBulkSubtitleModal();
    }
});

seriesModal.addEventListener("click", (event) => {
    if (event.target === seriesModal) {
        closeSeriesModal();
    }
});

loadLibrarySeries().catch((err) => {
    console.error(err);
    librarySummary.textContent = err.message;
});

function openSeriesModal() {
    seriesModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeSeriesModal() {
    seriesModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentOpenedSeries = null;
    currentOpenedEpisodes = [];
}

closeCoverModalBtn.addEventListener("click", () => {
    closeCoverModal();
});

coverSearchBtn.addEventListener("click", () => {
    searchCoversForCurrentSeries();
});

coverSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchCoversForCurrentSeries();
    }
});

coverModal.addEventListener("click", (event) => {
    if (event.target === coverModal) {
        closeCoverModal();
    }
});

closeSubtitleModalBtn.addEventListener("click", () => {
    closeSubtitleModal();
});

subtitleSearchBtn.addEventListener("click", () => {
    searchSubtitlesForCurrentEpisode();
});

subtitleSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchSubtitlesForCurrentEpisode();
    }
});

subtitleModal.addEventListener("click", (event) => {
    if (event.target === subtitleModal) {
        closeSubtitleModal();
    }
});

closeBulkSubtitleModalBtn.addEventListener("click", () => {
    closeBulkSubtitleModal();
});

cancelBulkSubtitleDownloadBtn.addEventListener("click", () => {
    closeBulkSubtitleModal();
});

confirmBulkSubtitleDownloadBtn.addEventListener("click", () => {
    downloadSelectedBulkSubtitles();
});

bulkSubtitleSearchBtn.addEventListener("click", () => {
    analyzeMissingSubtitlesForCurrentSeries();
});

bulkSubtitleSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        analyzeMissingSubtitlesForCurrentSeries();
    }
});

bulkSubtitleModal.addEventListener("click", (event) => {
    if (event.target === bulkSubtitleModal) {
        closeBulkSubtitleModal();
    }
});

if (bulkSubtitleSets) {
    bulkSubtitleSets.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest(".bulk-subtitle-set-btn") as HTMLButtonElement | null;
        if (!button || button.disabled) return;
        applyBulkSubtitleSet(button.dataset.releaseKey);
    });
}

bulkSubtitleList.addEventListener("change", (event) => {
    const target = event.target as HTMLElement | null;

    if (target && target.classList.contains("bulk-subtitle-checkbox")) {
        updateBulkSubtitleConfirmState();
        return;
    }

    if (target && target.classList.contains("bulk-subtitle-select")) {
        const select = target as HTMLSelectElement;
        const episodeId = String(select.dataset.episodeId);
        const value = String(select.value || "");
        const item = (currentBulkSubtitlePlan?.items || []).find((item) => String(item.episodeId) === episodeId);
        if (!item) return;

        const candidate = (item.candidates || []).find((candidate) => candidateKey(candidate) === value);
        if (candidate) {
            item.selected = candidate;
            item.status = "ready";
            item.message = lt("selectedManually");
        } else {
            item.selected = null;
            item.status = item.candidates?.length ? "needs-review" : "skipped";
            item.message = item.candidates?.length ? lt("chooseSubtitleSetOrManual") : lt("noSubtitleSelected");
        }

        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
    }
});

seriesGrid.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(".series-delete-card-btn") as HTMLButtonElement | null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    deleteSeriesFromLibrary(button.dataset.seriesId, button.dataset.seriesTitle);
});

if (deleteSeriesBtn) {
    deleteSeriesBtn.addEventListener("click", () => {
        if (!currentOpenedSeries) return;
        deleteSeriesFromLibrary(currentOpenedSeries.id, currentOpenedSeries.title);
    });
}

relinkSeriesFilesBtn.addEventListener("click", relinkCurrentSeriesFiles);

changeSeriesCoverBtn.addEventListener("click", () => {
    if (!currentOpenedSeries) return;
    openCoverSearchModal(currentOpenedSeries);
});

downloadMissingSubtitlesBtn.addEventListener("click", () => {
    prepareMissingSubtitlesForCurrentSeries();
});

applyLibraryLanguage();
