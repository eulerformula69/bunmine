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
bindVocabularyReportController();
