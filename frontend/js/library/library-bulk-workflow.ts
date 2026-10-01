import { LibraryBulkModel } from "./library-bulk-model.js";
import { requestSubtitleWithRetry } from "./library-subtitle-request.js";
import { JIMAKU_DOWNLOAD_CONCURRENCY, JIMAKU_PLAN_REQUEST_DELAY_MS } from "../core/rate-limit.js";
import { bulkSubtitleList,bulkSubtitleModal,bulkSubtitleModalSubtitle,bulkSubtitleModalTitle,bulkSubtitleSearchBtn,bulkSubtitleSearchInput,bulkSubtitleSets,bulkSubtitleStatus,cancelBulkSubtitleDownloadBtn,closeBulkSubtitleModalBtn,confirmBulkSubtitleDownloadBtn,downloadMissingSubtitlesBtn } from "./library-dom.js";

import { currentBulkSubtitlePlanState,currentBulkSubtitleSetKeyState,currentOpenedSeriesState,isBulkSubtitleDownloadingState,isBulkSubtitlePreparingState } from "./library-state.js";

import { lt } from "./library-i18n.js";

import { getSelectedBulkSubtitleItems,renderBulkSubtitlePlan,updateBulkSubtitleConfirmState } from "./bulk-subtitle-view.js";

import { BulkSubtitlePlan, BulkSubtitlePlanItem } from "./library-types.js";

import { loadLibrarySeries,openSeries } from "./library.js";

import { libraryAnalyzeSeriesSubtitles,libraryPlanEpisodeSubtitle,librarySelectEpisodeSubtitle } from "./library-api.js";

import { sleep } from "../core/api.js";



export function openBulkSubtitleModal() {
    bulkSubtitleModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

export function closeBulkSubtitleModal() {
    if (isBulkSubtitlePreparingState.value) return;
    bulkDownloadController?.abort();
    bulkSubtitleModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentBulkSubtitlePlanState.value = null;
    currentBulkSubtitleSetKeyState.value = null;
    if (bulkSubtitleSets) bulkSubtitleSets.replaceChildren();
    bulkSubtitleList.replaceChildren();
    bulkSubtitleStatus.textContent = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
}

export async function prepareMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeriesState.value) return;

    currentBulkSubtitlePlanState.value = null;
    currentBulkSubtitleSetKeyState.value = null;
    bulkSubtitleModalTitle.textContent = lt("downloadMissingJapaneseSubtitles");
    bulkSubtitleModalSubtitle.textContent = currentOpenedSeriesState.value.title;
    bulkSubtitleSearchInput.value = currentOpenedSeriesState.value.title;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("subtitleQueryHint");
    if (bulkSubtitleSets) bulkSubtitleSets.replaceChildren();
    bulkSubtitleList.replaceChildren();
    confirmBulkSubtitleDownloadBtn.disabled = true;
    openBulkSubtitleModal();
    bulkSubtitleSearchInput.focus();
    bulkSubtitleSearchInput.select();
}

export async function analyzeMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeriesState.value || isBulkSubtitlePreparingState.value || isBulkSubtitleDownloadingState.value) return;

    const query = bulkSubtitleSearchInput.value.trim() || currentOpenedSeriesState.value.title;
    currentBulkSubtitlePlanState.value = null;
    currentBulkSubtitleSetKeyState.value = null;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("analyzingJimakuEntries");
    if (bulkSubtitleSets) bulkSubtitleSets.replaceChildren();
    bulkSubtitleList.replaceChildren();
    confirmBulkSubtitleDownloadBtn.disabled = true;

    const previousText = downloadMissingSubtitlesBtn.textContent;
    const previousSearchText = bulkSubtitleSearchBtn.textContent;
    downloadMissingSubtitlesBtn.disabled = true;
    bulkSubtitleSearchBtn.disabled = true;
    bulkSubtitleSearchBtn.textContent = lt("searching");
    downloadMissingSubtitlesBtn.textContent = lt("analyzing");
    isBulkSubtitlePreparingState.value = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;

    try {
        const data = await requestSeriesSubtitleAnalysisWithBackoff(currentOpenedSeriesState.value.id, query);
        currentBulkSubtitlePlanState.value = data;
        renderBulkSubtitlePlan(data);

        const selectable = (data.items || []).filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
        const skipped = (data.items || []).filter((item) => item.status === "skipped").length;
        bulkSubtitleStatus.textContent = selectable
            ? lt("analysisReadyChoose", { selectable, skipped, entries: data.entriesChecked || 0 })
            : lt("analysisReadyNone", { skipped, entries: data.entriesChecked || 0 });
    } catch (err) {
        bulkSubtitleStatus.classList.add("error");
        bulkSubtitleStatus.textContent = (err instanceof Error ? err.message : String(err));
    } finally {
        isBulkSubtitlePreparingState.value = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        downloadMissingSubtitlesBtn.disabled = false;
        bulkSubtitleSearchBtn.disabled = false;
        bulkSubtitleSearchBtn.textContent = previousSearchText;
        downloadMissingSubtitlesBtn.textContent = previousText;
        renderBulkSubtitlePlan(currentBulkSubtitlePlanState.value || { items: [] });
        updateBulkSubtitleConfirmState();
    }
}

export async function requestSeriesSubtitleAnalysisWithBackoff(seriesId: string | number, query: string): Promise<BulkSubtitlePlan> {
    const data = await requestSubtitleWithRetry(() => libraryAnalyzeSeriesSubtitles(seriesId, query), {
        failureMessage: lt("couldNotAnalyzeJimaku"), exhaustedMessage: lt("jimakuRetryReached"),
        onWait: waitMs => {
        bulkSubtitleStatus.textContent = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        }
    });
    return data as BulkSubtitlePlan;
}

export async function requestEpisodeSubtitlePlanWithBackoff(item: BulkSubtitlePlanItem) {
    const series = currentOpenedSeriesState.value;
    if (!series) return;
    const data = await requestSubtitleWithRetry(() => libraryPlanEpisodeSubtitle(item.episodeId, series.title), {
        failureMessage: lt("couldNotSearchEpisodeJimaku"), exhaustedMessage: lt("jimakuRetryReached"),
        onWait: waitMs => {
        item.status = "rate-limited";
        item.message = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        renderBulkSubtitlePlan(currentBulkSubtitlePlanState.value);
        }
    });
    return data.item;
}

export async function prepareBulkSubtitlePlanGradually(plan: BulkSubtitlePlan) {
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
            if (currentBulkSubtitleSetKeyState.value) {
                const candidates = Array.isArray(item.candidates) ? item.candidates : [];
                const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(currentBulkSubtitleSetKeyState.value));
                if (candidate) {
                    item.selected = candidate;
                    item.status = "ready";
                    item.message = lt("selectedFromSubtitleSet");
                }
            }
        } catch (err) {
            item.status = "failed";
            item.message = (err instanceof Error ? err.message : String(err));
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

export async function postSubtitleDownloadWithBackoff(item: BulkSubtitlePlanItem, signal?: AbortSignal) {
    const selected = item.selected;
    if (!selected) throw new Error(lt("noSubtitleSelected"));
    const data = await requestSubtitleWithRetry(() => librarySelectEpisodeSubtitle(item.episodeId, {
            source: selected.source,
            entryId: selected.entryId,
            filename: selected.filename,
            downloadUrl: selected.downloadUrl
        }, signal), {
        signal,
        failureMessage: lt("couldNotSaveSubtitle"), exhaustedMessage: lt("jimakuRetryReached"),
        onWait: waitMs => {
        const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);
        if (stateEl) stateEl.textContent = lt("rateLimitedRetrying", { seconds: Math.ceil(waitMs / 1000) });
        }
    });
    return data;
}

let bulkDownloadController: AbortController | null = null;

export async function downloadSelectedBulkSubtitles() {
    if (isBulkSubtitleDownloadingState.value) return;
    const items = getSelectedBulkSubtitleItems();
    if (!items.length) return;
    const controller = new AbortController();
    bulkDownloadController = controller;
    const seriesId = currentOpenedSeriesState.value?.id;

    isBulkSubtitleDownloadingState.value = true;
    confirmBulkSubtitleDownloadBtn.disabled = true;
    cancelBulkSubtitleDownloadBtn.disabled = false;
    closeBulkSubtitleModalBtn.disabled = false;
    bulkSubtitleList.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((input) => {
        input.disabled = true;
    });

    let downloaded = 0;
    let failed = 0;
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length && !controller.signal.aborted) {
            const index = nextIndex;
            nextIndex += 1;
            const item = items[index];
            const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);

            bulkSubtitleStatus.textContent = lt("downloadingProgress", { done: downloaded + failed, total: items.length, concurrency: Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length) });
            if (stateEl) stateEl.textContent = lt("downloadingState");

            try {
                await postSubtitleDownloadWithBackoff(item, controller.signal);
                downloaded += 1;
                if (stateEl) stateEl.textContent = lt("downloadedState");
            } catch (err) {
                if (controller.signal.aborted) return;
                failed += 1;
                if (stateEl) stateEl.textContent = lt("failedState", { message: (err instanceof Error ? err.message : String(err)) });
            }

            bulkSubtitleStatus.textContent = lt("downloadingSummary", { done: downloaded + failed, total: items.length, downloaded, failed });
        }
    }

    try {
        const workerCount = Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        if (controller.signal.aborted) return;
        bulkSubtitleStatus.textContent = lt("finishedDownloads", { downloaded, failed });
        if (seriesId !== undefined) await openSeries(seriesId);
        await loadLibrarySeries();
    } finally {
        bulkDownloadController = null;
        isBulkSubtitleDownloadingState.value = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        confirmBulkSubtitleDownloadBtn.disabled = true;
    }
}

export function applyBulkSubtitleSet(releaseKey: string) {
    if (!currentBulkSubtitlePlanState.value) return;
    currentBulkSubtitleSetKeyState.value = releaseKey;
    LibraryBulkModel.applySet(currentBulkSubtitlePlanState.value, releaseKey, lt);
    renderBulkSubtitlePlan(currentBulkSubtitlePlanState.value);
}
