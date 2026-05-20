const seriesGrid = document.getElementById("seriesGrid");
const librarySummary = document.getElementById("librarySummary");
const scanLibraryBtn = document.getElementById("scanLibraryBtn");

const seriesModal = document.getElementById("seriesModal");
const seriesPanel = document.getElementById("seriesPanel");
const seriesTitle = document.getElementById("seriesTitle");
const seriesStats = document.getElementById("seriesStats");
const episodeList = document.getElementById("episodeList");
const closeSeriesPanelBtn = document.getElementById("closeSeriesPanelBtn");

const coverModal = document.getElementById("coverModal");
const coverModalTitle = document.getElementById("coverModalTitle");
const coverModalSubtitle = document.getElementById("coverModalSubtitle");
const closeCoverModalBtn = document.getElementById("closeCoverModalBtn");
const coverSearchInput = document.getElementById("coverSearchInput");
const coverSearchBtn = document.getElementById("coverSearchBtn");
const coverResults = document.getElementById("coverResults");

const subtitleModal = document.getElementById("subtitleModal");
const subtitleModalTitle = document.getElementById("subtitleModalTitle");
const subtitleModalSubtitle = document.getElementById("subtitleModalSubtitle");
const closeSubtitleModalBtn = document.getElementById("closeSubtitleModalBtn");
const subtitleSearchInput = document.getElementById("subtitleSearchInput");
const subtitleSearchBtn = document.getElementById("subtitleSearchBtn");
const subtitleResults = document.getElementById("subtitleResults");

const changeSeriesCoverBtn = document.getElementById("changeSeriesCoverBtn");
const downloadMissingSubtitlesBtn = document.getElementById("downloadMissingSubtitlesBtn");
const bulkSubtitleModal = document.getElementById("bulkSubtitleModal");
const bulkSubtitleModalTitle = document.getElementById("bulkSubtitleModalTitle");
const bulkSubtitleModalSubtitle = document.getElementById("bulkSubtitleModalSubtitle");
const closeBulkSubtitleModalBtn = document.getElementById("closeBulkSubtitleModalBtn");
const bulkSubtitleStatus = document.getElementById("bulkSubtitleStatus");
const bulkSubtitleSets = document.getElementById("bulkSubtitleSets");
const bulkSubtitleList = document.getElementById("bulkSubtitleList");
const confirmBulkSubtitleDownloadBtn = document.getElementById("confirmBulkSubtitleDownloadBtn");
const cancelBulkSubtitleDownloadBtn = document.getElementById("cancelBulkSubtitleDownloadBtn");

let currentCoverSeries = null;
let currentSubtitleEpisode = null;
let currentOpenedSeries = null;
let currentBulkSubtitlePlan = null;
let currentBulkSubtitleSetKey = null;
let isBulkSubtitleDownloading = false;
let isBulkSubtitlePreparing = false;

const JIMAKU_PLAN_REQUEST_DELAY_MS = 1300;
const JIMAKU_429_DEFAULT_WAIT_MS = 12000;
const JIMAKU_429_MAX_RETRIES = 4;
const JIMAKU_DOWNLOAD_CONCURRENCY = 2;

function updateSeriesCompletedCount(seriesId, delta) {
    const cards = document.querySelectorAll(".series-card");

    for (const card of cards) {
        if (String(card.dataset.seriesId) !== String(seriesId)) continue;

        const completedEl = card.querySelector("[data-completed-episodes]");
        const totalEl = card.querySelector("[data-total-episodes]");
        const fillEl = card.querySelector(".progress-bar-fill");

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

function formatTime(seconds) {
    const value = Number(seconds || 0);

    if (value <= 0) return "0m";

    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (value <= 0) return "";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


function statusIcon(status) {
    if (status === "linked") return "✓";
    if (status === "partial") return "!";
    return "×";
}

function statusTitle(status) {
    if (status === "linked") return "All linked";
    if (status === "partial") return "Partially linked";
    return "Missing files";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadLibrarySeries() {
    seriesGrid.innerHTML = "";
    librarySummary.textContent = "Loading...";

    const { response, data } = await apiJson("/library/series");

    if (!response.ok || data.error) {
        throw new Error(data.error || "Could not load library");
    }

    const series = Array.isArray(data.series) ? data.series : [];

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
		`${series.length} series · ${completedEpisodes}/${totalEpisodes} watched`;

    for (const item of series) {
        seriesGrid.appendChild(renderSeriesCard(item));
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
            <div class="link-badge ${escapeHtml(item.linkStatus)}" title="${escapeHtml(statusTitle(item.linkStatus))}">
                ${escapeHtml(statusIcon(item.linkStatus))}
            </div>
        </div>

        <div class="series-title">${escapeHtml(item.title)}</div>

		<div class="series-meta">
			<span>
				<span data-completed-episodes>${escapeHtml(item.completedEpisodes)}</span>/<span data-total-episodes>${escapeHtml(item.episodesCount)}</span> eps
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
    seriesTitle.textContent = "Loading...";
    seriesStats.textContent = "";
    episodeList.innerHTML = "";

    const { response, data } = await apiJson(`/library/series/${encodeURIComponent(seriesId)}`);

    if (!response.ok || data.error) {
        seriesTitle.textContent = "Error";
        seriesStats.textContent = data.error || "Could not load series";
        return;
    }

    const series = data.series;
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];
	currentOpenedSeries = {
		...series,
		completedEpisodes: episodes.filter((episode) => episode.completed).length
	};

    seriesTitle.textContent = series.title;
    seriesStats.textContent =
        `${series.episodesWithVideo}/${series.episodesCount} video · ` +
        `${series.episodesWithSubtitle}/${series.episodesCount} subtitles · ` +
        `${series.linkStatus}`;

    episodeList.innerHTML = "";

    for (const episode of episodes) {
        episodeList.appendChild(renderEpisodeRow(episode));
    }
}

function renderEpisodeRow(episode) {
    const row = document.createElement("div");
    row.className = "episode-row";

    const status = episode.linkStatus;
    const canOpen = Boolean(episode.hasVideo);

    const watched = episode.completed
        ? "watched"
        : episode.currentTimeSeconds > 0
            ? `at ${formatTime(episode.currentTimeSeconds)}`
            : "not watched";

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
                <span>${episode.hasVideo ? "video ✓" : "video ×"}</span>
                <span>·</span>
                <span>${episode.hasSubtitle ? "subtitles ✓" : "subtitles ×"}</span>
                <button
                    class="find-subtitles-btn find-subtitles-btn-inline"
                    type="button"
                    ${canOpen ? "" : "disabled"}
                    data-episode-id="${escapeHtml(episode.id)}"
                >
                    ${episode.hasSubtitle ? "Change JP subs" : "Find JP subs"}
                </button>
                <span>·</span>
				<span data-episode-watched-text>${escapeHtml(watched)}</span>
            </div>
        </div>

        <div class="episode-actions">
            <a class="open-episode-link ${canOpen ? "" : "disabled"}"
               href="/?episodeId=${encodeURIComponent(episode.id)}">
                Open
            </a>
        </div>
    `;

	const completedCheckbox = row.querySelector(".episode-completed-checkbox");

	completedCheckbox.addEventListener("click", (event) => {
		event.stopPropagation();
	});

completedCheckbox.addEventListener("change", async () => {
    const previousValue = !completedCheckbox.checked;
    const nextValue = completedCheckbox.checked;

    completedCheckbox.disabled = true;

    try {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(episode.id)}/completed`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    completed: nextValue
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || "Could not update episode status");
        }

        const delta = nextValue ? 1 : -1;

        episode.completed = nextValue;
        updateCurrentSeriesStatsText(delta);
        updateSeriesCompletedCount(currentOpenedSeries?.id, delta);

        const watchedText = row.querySelector("[data-episode-watched-text]");
        if (watchedText) {
            watchedText.textContent = nextValue
                ? "watched"
                : episode.currentTimeSeconds > 0
                    ? `at ${formatTime(episode.currentTimeSeconds)}`
                    : "not watched";
        }
    } catch (err) {
        completedCheckbox.checked = previousValue;
        alert(err.message);
    } finally {
        completedCheckbox.disabled = false;
    }
});

    const findSubtitlesBtn = row.querySelector(".find-subtitles-btn");
    if (findSubtitlesBtn) {
        findSubtitlesBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            openSubtitleSearchModal(episode, row);
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

async function openSubtitleSearchModal(episode, row) {
    if (!currentOpenedSeries) return;

    currentSubtitleEpisode = { episode, row };

    const episodeNumber = episode.episodeNumber ?? "?";
    subtitleModalTitle.textContent = episode.hasSubtitle ? "Change Japanese subtitles" : "Find Japanese subtitles";
    subtitleModalSubtitle.textContent = `${currentOpenedSeries.title} · Episode ${episodeNumber}`;
    subtitleSearchInput.value = currentOpenedSeries.title;
    subtitleResults.innerHTML = "";

    openSubtitleModal();

    await searchSubtitlesForCurrentEpisode();
}

async function searchSubtitlesForCurrentEpisode() {
    if (!currentSubtitleEpisode) return;

    const { episode } = currentSubtitleEpisode;
    const query = subtitleSearchInput.value.trim() || currentOpenedSeries?.title || "";

    subtitleSearchBtn.disabled = true;
    subtitleSearchBtn.textContent = "Searching...";
    subtitleResults.innerHTML = `<div class="cover-message">Searching Jimaku...</div>`;

    try {
        const url =
            `/library/episodes/${encodeURIComponent(episode.id)}/subtitles/search` +
            `?q=${encodeURIComponent(query)}`;

        const { response, data } = await apiJson(url);

        if (!response.ok || data.error) {
            throw new Error(data.error || "Subtitle search failed");
        }

        renderSubtitleResults(data.results || []);
    } catch (err) {
        subtitleResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        subtitleSearchBtn.disabled = false;
        subtitleSearchBtn.textContent = "Search";
    }
}

function renderSubtitleResults(results) {
    subtitleResults.innerHTML = "";

    if (!results.length) {
        subtitleResults.innerHTML = `<div class="cover-message">No direct .srt/.ass/.vtt subtitles found.</div>`;
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
                <div class="cover-result-title">${escapeHtml(result.filename || "Untitled subtitle")}</div>
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
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(episode.id)}/subtitles/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: result.source,
                    entryId: result.entryId,
                    filename: result.filename,
                    downloadUrl: result.downloadUrl
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || "Could not save subtitle");
        }

        episode.hasSubtitle = true;
        episode.subtitleFileId = data.subtitleFileId;
        episode.linkStatus = episode.hasVideo ? "linked" : "partial";

        const meta = row.querySelector(".episode-meta");
        if (meta) {
            const watchedText = row.querySelector("[data-episode-watched-text]")?.outerHTML || "";
            meta.innerHTML = `${episode.hasVideo ? "video ✓" : "video ×"} <span>·</span> <span>subtitles ✓</span> <button class="find-subtitles-btn find-subtitles-btn-inline" type="button" ${episode.hasVideo ? "" : "disabled"} data-episode-id="${escapeHtml(episode.id)}">Change JP subs</button> <span>·</span> ${watchedText}`;
        }

        const btn = row.querySelector(".find-subtitles-btn");
        if (btn) btn.textContent = "Change JP subs";

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
    bulkSubtitleModalTitle.textContent = "Download missing Japanese subtitles";
    bulkSubtitleModalSubtitle.textContent = currentOpenedSeries.title;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = "Analyzing Jimaku series entries...";
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
    openBulkSubtitleModal();

    const previousText = downloadMissingSubtitlesBtn.textContent;
    downloadMissingSubtitlesBtn.disabled = true;
    downloadMissingSubtitlesBtn.textContent = "Analyzing...";
    isBulkSubtitlePreparing = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;

    try {
        const data = await requestSeriesSubtitleAnalysisWithBackoff(currentOpenedSeries.id, currentOpenedSeries.title);
        currentBulkSubtitlePlan = data;
        renderBulkSubtitlePlan(data);

        const selectable = (data.items || []).filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
        const skipped = (data.items || []).filter((item) => item.status === "skipped").length;
        bulkSubtitleStatus.textContent = selectable
            ? `Analysis ready: choose one subtitle set · ${selectable} episodes have candidates · ${skipped} skipped · ${data.entriesChecked || 0} entries checked`
            : `Analysis ready: no matching subtitles found · ${skipped} skipped · ${data.entriesChecked || 0} entries checked`;
    } catch (err) {
        bulkSubtitleStatus.classList.add("error");
        bulkSubtitleStatus.textContent = err.message;
    } finally {
        isBulkSubtitlePreparing = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        downloadMissingSubtitlesBtn.disabled = false;
        downloadMissingSubtitlesBtn.textContent = previousText;
        renderBulkSubtitlePlan(currentBulkSubtitlePlan || { items: [] });
        updateBulkSubtitleConfirmState();
    }
}

async function requestSeriesSubtitleAnalysisWithBackoff(seriesId, query) {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/series/${encodeURIComponent(seriesId)}/subtitles/analyze`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || "Could not analyze Jimaku subtitles");
            }
            return data;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        bulkSubtitleStatus.textContent = `Jimaku rate limit. Waiting ${Math.ceil(waitMs / 1000)}s before retry...`;
        await sleep(waitMs);
    }

    throw new Error("Jimaku rate limit: retry limit reached");
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
    return String(candidate?.downloadUrl || `${candidate?.entryId || ""}:${candidate?.filename || ""}`);
}

function formatSubtitleCandidate(candidate) {
    if (!candidate) return "";
    return [
        candidate.filename,
        candidate.entryTitle,
        candidate.extension,
        formatBytes(candidate.sizeBytes),
        candidate.lastModified ? String(candidate.lastModified).slice(0, 10) : null,
    ].filter(Boolean).join(" · ");
}

function getBulkSubtitleSets(plan) {
    const items = Array.isArray(plan?.items) ? plan.items : [];
    const totalEpisodes = items.filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
    const byKey = new Map();

    for (const item of items) {
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const usedForEpisode = new Set();

        for (const candidate of candidates) {
            const releaseKey = String(candidate.releaseKey || candidate.entryTitle || "other");
            if (!releaseKey || usedForEpisode.has(releaseKey)) continue;
            usedForEpisode.add(releaseKey);

            if (!byKey.has(releaseKey)) {
                byKey.set(releaseKey, {
                    key: releaseKey,
                    label: candidate.releaseLabel || candidate.entryTitle || "Other",
                    count: 0,
                    totalEpisodes,
                    examples: [],
                    candidatesByEpisodeId: new Map(),
                });
            }

            const group = byKey.get(releaseKey);
            group.count += 1;
            group.candidatesByEpisodeId.set(String(item.episodeId), candidate);
            if (group.examples.length < 2) {
                group.examples.push(candidate.filename || candidate.entryTitle || "subtitle");
            }
        }
    }

    return Array.from(byKey.values())
        .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

function renderBulkSubtitleSets(plan) {
    if (!bulkSubtitleSets) return;

    const items = Array.isArray(plan?.items) ? plan.items : [];
    const hasPending = items.some((item) => ["pending", "searching", "rate-limited"].includes(item.status));
    const sets = getBulkSubtitleSets(plan);

    bulkSubtitleSets.innerHTML = "";

    if (!sets.length) {
        if (!hasPending) {
            bulkSubtitleSets.innerHTML = `<div class="cover-message">No subtitle sets found.</div>`;
        }
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "bulk-subtitle-sets-inner";

    const title = document.createElement("div");
    title.className = "bulk-subtitle-sets-title";
    title.textContent = hasPending
        ? "Suggested sets found so far"
        : "Choose one subtitle set before downloading";
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

    for (const item of currentBulkSubtitlePlan.items || []) {
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(releaseKey));

        if (candidate) {
            item.selected = candidate;
            item.status = "ready";
            item.message = "Selected from subtitle set";
        } else if (candidates.length) {
            item.selected = null;
            item.status = "needs-review";
            item.message = "No file from selected set. Choose manually if needed.";
        }
    }

    renderBulkSubtitlePlan(currentBulkSubtitlePlan);
}

async function requestEpisodeSubtitlePlanWithBackoff(item) {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(item.episodeId)}/subtitles/plan`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: currentOpenedSeries.title
                })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || "Could not search Jimaku for this episode");
            }
            return data.item;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        item.status = "rate-limited";
        item.message = `Jimaku rate limit. Waiting ${Math.ceil(waitMs / 1000)}s before retry...`;
        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
        await sleep(waitMs);
    }

    throw new Error("Jimaku rate limit: retry limit reached");
}

async function prepareBulkSubtitlePlanGradually(plan) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    if (!items.length) {
        bulkSubtitleStatus.textContent = "No episodes with missing subtitles.";
        return;
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        item.status = "searching";
        item.message = "Searching Jimaku...";
        renderBulkSubtitlePlan(plan);
        bulkSubtitleStatus.textContent = `Searching Jimaku ${index + 1}/${items.length}: episode ${item.episodeNumber ?? "?"}...`;

        try {
            const plannedItem = await requestEpisodeSubtitlePlanWithBackoff(item);
            Object.assign(item, plannedItem);
            if (currentBulkSubtitleSetKey) {
                const candidates = Array.isArray(item.candidates) ? item.candidates : [];
                const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(currentBulkSubtitleSetKey));
                if (candidate) {
                    item.selected = candidate;
                    item.status = "ready";
                    item.message = "Selected from subtitle set";
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
        ? `Plan ready: ${selected} selected · ${selectable - selected} need review · ${skipped} skipped · ${failed} failed`
        : `Plan ready: choose one subtitle set · ${selectable} episodes have candidates · ${skipped} skipped · ${failed} failed`;
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
            `${readyItems.length} selected · ${reviewItems.length} need review · ${skippedItems.length} skipped · ${failedItems.length} failed`;
    } else if (pendingItems.length) {
        bulkSubtitleStatus.textContent =
            `${readyItems.length} selected · ${pendingItems.length} still being checked · ${failedItems.length} failed`;
    }

    renderBulkSubtitleSets(plan);
    bulkSubtitleList.innerHTML = "";

    if (!items.length) {
        bulkSubtitleList.innerHTML = `<div class="cover-message">No episodes with missing subtitles.</div>`;
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
                ? item.message || "Choose one subtitle set or select manually"
                : item.message || "No subtitle selected";

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
                    Episode ${escapeHtml(item.episodeNumber ?? "?")} · ${escapeHtml(item.episodeTitle || "Untitled")}
                </div>
                <div class="bulk-subtitle-meta">${escapeHtml(meta)}</div>
                ${hasManualChoices ? `
                    <select class="bulk-subtitle-select" data-episode-id="${escapeHtml(item.episodeId)}">
                        <option value="">Choose manually...</option>
                        ${candidates.map((candidate) => `
                            <option value="${escapeHtml(candidateKey(candidate))}" ${selected && candidateKey(candidate) === candidateKey(selected) ? "selected" : ""}>
                                ${escapeHtml(candidate.releaseLabel || candidate.entryTitle || "Other")} — ${escapeHtml(candidate.filename || "subtitle")}
                            </option>
                        `).join("")}
                    </select>
                ` : ""}
            </div>
            <div class="bulk-subtitle-state" data-bulk-state-for="${escapeHtml(item.episodeId)}">
                ${escapeHtml(canDownload ? "ready" : item.status || "skipped")}
            </div>
        `;

        bulkSubtitleList.appendChild(row);
    }

    updateBulkSubtitleConfirmState();
}

function getSelectedBulkSubtitleItems() {
    if (!currentBulkSubtitlePlan) return [];

    const selectedIds = new Set(
        Array.from(bulkSubtitleList.querySelectorAll(".bulk-subtitle-checkbox:checked"))
            .map((checkbox) => String(checkbox.dataset.episodeId))
    );

    return (currentBulkSubtitlePlan.items || []).filter((item) => {
        return item.status === "ready" && item.selected && selectedIds.has(String(item.episodeId));
    });
}

async function postSubtitleDownloadWithBackoff(item) {
    const selected = item.selected;

    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(item.episodeId)}/subtitles/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: selected.source,
                    entryId: selected.entryId,
                    filename: selected.filename,
                    downloadUrl: selected.downloadUrl
                })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || "Could not save subtitle");
            }
            return data;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);
        if (stateEl) stateEl.textContent = `rate limited, retrying in ${Math.ceil(waitMs / 1000)}s...`;
        await sleep(waitMs);
    }

    throw new Error("Jimaku rate limit: retry limit reached");
}

async function downloadSelectedBulkSubtitles() {
    const items = getSelectedBulkSubtitleItems();
    if (!items.length) return;

    isBulkSubtitleDownloading = true;
    confirmBulkSubtitleDownloadBtn.disabled = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;
    bulkSubtitleList.querySelectorAll("input, select").forEach((input) => {
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

            bulkSubtitleStatus.textContent = `Downloading ${downloaded + failed}/${items.length} completed · ${Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length)} at a time...`;
            if (stateEl) stateEl.textContent = `downloading...`;

            try {
                await postSubtitleDownloadWithBackoff(item);
                downloaded += 1;
                if (stateEl) stateEl.textContent = "downloaded";
            } catch (err) {
                failed += 1;
                if (stateEl) stateEl.textContent = `failed: ${err.message}`;
            }

            bulkSubtitleStatus.textContent = `Downloading ${downloaded + failed}/${items.length} completed · ${downloaded} downloaded · ${failed} failed`;
        }
    }

    try {
        const workerCount = Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length);
        await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));
        bulkSubtitleStatus.textContent = `Finished: ${downloaded} downloaded, ${failed} failed.`;
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

    coverModalTitle.textContent = series.coverUrl ? "Change cover" : "Find cover";
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
    coverSearchBtn.textContent = "Searching...";
    coverResults.innerHTML = `<div class="cover-message">Searching AniList...</div>`;

    try {
        const url =
            `/library/series/${encodeURIComponent(currentCoverSeries.id)}/cover/search` +
            `?q=${encodeURIComponent(query)}`;

        const { response, data } = await apiJson(url);

        if (!response.ok || data.error) {
            throw new Error(data.error || "Cover search failed");
        }

        renderCoverResults(data.results || []);
    } catch (err) {
        coverResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        coverSearchBtn.disabled = false;
        coverSearchBtn.textContent = "Search";
    }
}

function renderCoverResults(results) {
    coverResults.innerHTML = "";

    if (!results.length) {
        coverResults.innerHTML = `<div class="cover-message">No results found.</div>`;
        return;
    }

    for (const result of results) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cover-result-item";

        const meta = [
            result.format,
            result.seasonYear,
            result.episodes ? `${result.episodes} eps` : null,
        ].filter(Boolean).join(" · ");

        item.innerHTML = `
            <img src="${escapeHtml(result.coverUrl)}" alt="">
            <div class="cover-result-info">
                <div class="cover-result-title">${escapeHtml(result.title || result.preferredTitle || "Untitled")}</div>
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
        const { response, data } = await apiJson(
            `/library/series/${encodeURIComponent(currentCoverSeries.id)}/cover/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: result.source,
                    externalId: result.externalId,
                    coverUrl: result.coverUrl
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || "Could not save cover");
        }

        closeCoverModal();
        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        coverResults.classList.remove("is-loading");
    }
}

scanLibraryBtn.addEventListener("click", async () => {
    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = "Scanning...";

    try {
        const { response, data } = await apiJson("/library/scan");

        if (!response.ok || data.error) {
            throw new Error(data.error || "Scan failed");
        }

        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        scanLibraryBtn.disabled = false;
        scanLibraryBtn.textContent = "Scan library";
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

bulkSubtitleModal.addEventListener("click", (event) => {
    if (event.target === bulkSubtitleModal) {
        closeBulkSubtitleModal();
    }
});

if (bulkSubtitleSets) {
    bulkSubtitleSets.addEventListener("click", (event) => {
        const button = event.target.closest(".bulk-subtitle-set-btn");
        if (!button || button.disabled) return;
        applyBulkSubtitleSet(button.dataset.releaseKey);
    });
}

bulkSubtitleList.addEventListener("change", (event) => {
    if (event.target && event.target.classList.contains("bulk-subtitle-checkbox")) {
        updateBulkSubtitleConfirmState();
        return;
    }

    if (event.target && event.target.classList.contains("bulk-subtitle-select")) {
        const episodeId = String(event.target.dataset.episodeId);
        const value = String(event.target.value || "");
        const item = (currentBulkSubtitlePlan?.items || []).find((item) => String(item.episodeId) === episodeId);
        if (!item) return;

        const candidate = (item.candidates || []).find((candidate) => candidateKey(candidate) === value);
        if (candidate) {
            item.selected = candidate;
            item.status = "ready";
            item.message = "Selected manually";
        } else {
            item.selected = null;
            item.status = item.candidates?.length ? "needs-review" : "skipped";
            item.message = item.candidates?.length ? "Choose one subtitle set or select manually" : "No subtitle selected";
        }

        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
    }
});

changeSeriesCoverBtn.addEventListener("click", () => {
    if (!currentOpenedSeries) return;
    openCoverSearchModal(currentOpenedSeries);
});

downloadMissingSubtitlesBtn.addEventListener("click", () => {
    prepareMissingSubtitlesForCurrentSeries();
});


