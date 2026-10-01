import { addAnimeBtn, addAnimeFromPath, applyLibraryLanguage, bulkSubtitleList, bulkSubtitleModal, bulkSubtitleSearchBtn, bulkSubtitleSearchInput, bulkSubtitleSets, cancelBulkSubtitleDownloadBtn, changeSeriesCoverBtn, closeBulkSubtitleModalBtn, closeCoverModal, closeCoverModalBtn, closeSeriesPanelBtn, closeSeriesView, closeSubtitleModal, closeSubtitleModalBtn, confirmBulkSubtitleDownloadBtn, coverModal, coverSearchBtn, coverSearchInput, currentBulkSubtitlePlanState, currentOpenedSeriesState, deleteSeriesBtn, deleteSeriesFromLibrary, downloadMissingSubtitlesBtn, filterState, libraryFilters, librarySearchInput, librarySummary, loadLibrarySeries, openCoverSearchModal, openSeriesFromHash, relinkCurrentSeriesFiles, relinkSeriesFilesBtn, renderCatalog, saveLibraryViewState, scanLibraryBtn, searchCoversForCurrentSeries, searchSubtitlesForCurrentEpisode, seriesTabs, showError, startAndPollLibraryJob, subtitleModal, subtitleSearchBtn, subtitleSearchInput } from "./library.js";
import { lt } from "./library-i18n.js";
import { LibrarySeriesFilter, LibrarySeriesSort } from "./library-types.js";
import { analyzeMissingSubtitlesForCurrentSeries, applyBulkSubtitleSet, candidateKey, closeBulkSubtitleModal, downloadSelectedBulkSubtitles, prepareMissingSubtitlesForCurrentSeries, renderBulkSubtitlePlan, updateBulkSubtitleConfirmState } from "./library-bulk-workflow.js";
import { bindVocabularyReportController } from "./vocabulary-report-controller.js";
scanLibraryBtn.addEventListener("click", async () => {
    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");
    try {
        await startAndPollLibraryJob("/library/scan");
        await loadLibrarySeries();
    } catch (error) { showError(error); }
    finally { scanLibraryBtn.disabled = false; scanLibraryBtn.textContent = lt("scanLibrary"); }
});

addAnimeBtn.addEventListener("click", () => addAnimeFromPath().catch(showError));
closeSeriesPanelBtn.addEventListener("click", () => closeSeriesView());
librarySearchInput.addEventListener("input", () => { filterState.query = librarySearchInput.value; renderCatalog(); });
libraryFilters.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.filter) filterState.filter = button.dataset.filter as LibrarySeriesFilter;
    if (button.dataset.sort) filterState.sort = button.dataset.sort as LibrarySeriesSort;
    saveLibraryViewState();
    renderCatalog();
});

seriesTabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
    if (!button) return;
    seriesTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`${button.dataset.tab}Tab`)?.classList.remove("hidden");
});

changeSeriesCoverBtn.addEventListener("click", () => { if (currentOpenedSeriesState.value) openCoverSearchModal(currentOpenedSeriesState.value); });
relinkSeriesFilesBtn.addEventListener("click", () => relinkCurrentSeriesFiles().catch(showError));
downloadMissingSubtitlesBtn.addEventListener("click", () => prepareMissingSubtitlesForCurrentSeries());
deleteSeriesBtn.addEventListener("click", () => { if (currentOpenedSeriesState.value) deleteSeriesFromLibrary(currentOpenedSeriesState.value.id, currentOpenedSeriesState.value.title).catch(showError); });

closeCoverModalBtn.addEventListener("click", closeCoverModal);
coverSearchBtn.addEventListener("click", searchCoversForCurrentSeries);
coverSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") searchCoversForCurrentSeries(); });
closeSubtitleModalBtn.addEventListener("click", closeSubtitleModal);
subtitleSearchBtn.addEventListener("click", searchSubtitlesForCurrentEpisode);
subtitleSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") searchSubtitlesForCurrentEpisode(); });
closeBulkSubtitleModalBtn.addEventListener("click", closeBulkSubtitleModal);
cancelBulkSubtitleDownloadBtn.addEventListener("click", closeBulkSubtitleModal);
confirmBulkSubtitleDownloadBtn.addEventListener("click", downloadSelectedBulkSubtitles);
bulkSubtitleSearchBtn.addEventListener("click", analyzeMissingSubtitlesForCurrentSeries);
bulkSubtitleSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") analyzeMissingSubtitlesForCurrentSeries(); });
bulkSubtitleSets.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".bulk-subtitle-set-btn");
    if (button && !button.disabled) applyBulkSubtitleSet(button.dataset.releaseKey);
});
bulkSubtitleList.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.classList.contains("bulk-subtitle-checkbox")) return updateBulkSubtitleConfirmState();
    if (!target.classList.contains("bulk-subtitle-select")) return;
    const item = (currentBulkSubtitlePlanState.value?.items || []).find((value) => String(value.episodeId) === String(target.dataset.episodeId));
    if (!item) return;
    const candidate = (item.candidates || []).find((value) => candidateKey(value) === target.value);
    item.selected = candidate || null;
    item.status = candidate ? "ready" : item.candidates?.length ? "needs-review" : "skipped";
    item.message = candidate ? lt("selectedManually") : lt("noSubtitleSelected");
    renderBulkSubtitlePlan(currentBulkSubtitlePlanState.value);
});

for (const modal of [coverModal, subtitleModal, bulkSubtitleModal]) {
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.classList.add("hidden"); });
}
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeCoverModal(); closeSubtitleModal(); closeBulkSubtitleModal();
});
window.addEventListener("popstate", openSeriesFromHash);

applyLibraryLanguage();
bindVocabularyReportController();
loadLibrarySeries().catch((error) => { console.error(error); librarySummary.textContent = error.message; });
