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





