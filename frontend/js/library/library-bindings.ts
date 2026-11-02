import { coverController, subtitleController } from "./library.js";
import { LibraryBulkModel } from "./library-bulk-model.js";
import { logger } from "../core/logger.js";
import { addAnimeBtn,bulkSubtitleList,bulkSubtitleModal,bulkSubtitleSearchBtn,bulkSubtitleSearchInput,bulkSubtitleSets,cancelBulkSubtitleDownloadBtn,changeSeriesCoverBtn,closeBulkSubtitleModalBtn,closeCoverModalBtn,closeSeriesPanelBtn,closeSubtitleModalBtn,confirmBulkSubtitleDownloadBtn,coverModal,coverSearchBtn,coverSearchInput,deleteSeriesBtn,downloadMissingSubtitlesBtn,libraryFilters,librarySortSelect,librarySearchInput,librarySummary,relinkSeriesFilesBtn,scanLibraryBtn,seriesTabs,subtitleModal,subtitleSearchBtn,subtitleSearchInput } from "./library-dom.js";

import { lt } from "./library-i18n.js";

import { addAnimeFromPath,applyLibraryLanguage,closeSeriesView,deleteSeriesFromLibrary,filterState,loadLibrarySeries,openSeriesFromHash,relinkCurrentSeriesFiles,renderCatalog,saveLibraryViewState,showError,startAndPollLibraryJob } from "./library.js";

import { LibrarySeriesFilter,LibrarySeriesSort } from "./library-types.js";

import { currentBulkSubtitlePlanState,currentOpenedSeriesState } from "./library-state.js";

import { applyBulkSubtitleSet,analyzeMissingSubtitlesForCurrentSeries,closeBulkSubtitleModal,downloadSelectedBulkSubtitles,prepareMissingSubtitlesForCurrentSeries } from "./library-bulk-workflow.js";

import { renderBulkSubtitlePlan,updateBulkSubtitleConfirmState } from "./bulk-subtitle-view.js";

import { bindVocabularyReportController } from "./vocabulary-report-controller.js";

scanLibraryBtn.addEventListener("click", async () => {
    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");
    try {
        await startAndPollLibraryJob("/library/scan", { method: "POST" });
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
    saveLibraryViewState();
    renderCatalog();
});

librarySortSelect.addEventListener("change", () => {
    filterState.sort = librarySortSelect.value as LibrarySeriesSort;
    saveLibraryViewState();
    renderCatalog();
});

function selectSeriesTab(button: HTMLButtonElement) {
    seriesTabs.querySelectorAll("button").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== `${button.dataset.tab}Tab`);
    });
}

seriesTabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
    if (button) selectSeriesTab(button);
});

seriesTabs.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(seriesTabs.querySelectorAll<HTMLButtonElement>("button[data-tab]"));
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    selectSeriesTab(buttons[next]);
    buttons[next].focus();
});

changeSeriesCoverBtn.addEventListener("click", () => { if (currentOpenedSeriesState.value) coverController.open(currentOpenedSeriesState.value); });

relinkSeriesFilesBtn.addEventListener("click", () => relinkCurrentSeriesFiles().catch(showError));

downloadMissingSubtitlesBtn.addEventListener("click", () => prepareMissingSubtitlesForCurrentSeries());

deleteSeriesBtn.addEventListener("click", () => { if (currentOpenedSeriesState.value) deleteSeriesFromLibrary(currentOpenedSeriesState.value.id, currentOpenedSeriesState.value.title).catch(showError); });

closeCoverModalBtn.addEventListener("click", coverController.close);

coverSearchBtn.addEventListener("click", coverController.search);

coverSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") coverController.search(); });

closeSubtitleModalBtn.addEventListener("click", subtitleController.close);

subtitleSearchBtn.addEventListener("click", subtitleController.search);

subtitleSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") subtitleController.search(); });

closeBulkSubtitleModalBtn.addEventListener("click", closeBulkSubtitleModal);

cancelBulkSubtitleDownloadBtn.addEventListener("click", closeBulkSubtitleModal);

confirmBulkSubtitleDownloadBtn.addEventListener("click", downloadSelectedBulkSubtitles);

bulkSubtitleSearchBtn.addEventListener("click", analyzeMissingSubtitlesForCurrentSeries);

bulkSubtitleSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") analyzeMissingSubtitlesForCurrentSeries(); });

bulkSubtitleSets.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".bulk-subtitle-set-btn");
    if (button && !button.disabled && button.dataset.releaseKey) applyBulkSubtitleSet(button.dataset.releaseKey);
});

bulkSubtitleList.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.classList.contains("bulk-subtitle-checkbox")) return updateBulkSubtitleConfirmState();
    if (!target.classList.contains("bulk-subtitle-select")) return;
    const item = (currentBulkSubtitlePlanState.value?.items || []).find((value) => String(value.episodeId) === String(target.dataset.episodeId));
    if (!item) return;
    const candidate = (item.candidates || []).find((value) => LibraryBulkModel.candidateKey(value) === target.value);
    item.selected = candidate || null;
    item.status = candidate ? "ready" : item.candidates?.length ? "needs-review" : "skipped";
    item.message = candidate ? lt("selectedManually") : lt("noSubtitleSelected");
    renderBulkSubtitlePlan(currentBulkSubtitlePlanState.value);
});

for (const [modal, close] of [[coverModal, coverController.close], [subtitleModal, subtitleController.close], [bulkSubtitleModal, closeBulkSubtitleModal]] as const) {
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
}

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    coverController.close(); subtitleController.close(); closeBulkSubtitleModal();
});

window.addEventListener("popstate", openSeriesFromHash);

applyLibraryLanguage();

bindVocabularyReportController();

loadLibrarySeries().catch((error) => { logger.error(error); librarySummary.textContent = error.message; });
