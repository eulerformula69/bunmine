function buildVocabularyReportPayload(root: ParentNode = document) {
    const statuses = Array.from(root.querySelectorAll<HTMLInputElement>('input[name="reportStatus"]:checked')).map(input => input.value);
    const selectedSheets = new Set(Array.from(root.querySelectorAll<HTMLInputElement>('input[name="reportSheet"]:checked')).map(input => input.value));
    const includeParticles = root.querySelector<HTMLInputElement>('#reportIncludeParticles')?.checked ?? false;
    const includeAuxiliaryForms = root.querySelector<HTMLInputElement>('#reportIncludeAuxiliaryForms')?.checked ?? false;
    return { statuses, includeParticles, includeAuxiliaryForms, sheets: { summary: selectedSheets.has("summary"), occurrences: selectedSheets.has("occurrences"), statistics: selectedSheets.has("statistics") } };
}

async function downloadVocabularyReport(seriesId: string | number, root: ParentNode = document) {
    const button = root.querySelector<HTMLButtonElement>("#confirmVocabularyReportBtn");
    const status = root.querySelector<HTMLElement>("#vocabularyReportStatus");
    if (!button || button.disabled) return;
    button.disabled = true; button.textContent = lt("preparingReport");
    if (status) status.textContent = lt("preparingReport");
    try {
        const started = await libraryStartJob(`/library/series/${encodeURIComponent(seriesId)}/vocabulary-report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildVocabularyReportPayload(root)) });
        const startedJob = started.data.job as LibraryJobData["job"];
        if (!started.response.ok || !startedJob?.id) throw new Error(getApiErrorMessage(started.data, lt("reportFailed")));
        const jobId = startedJob.id;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const current = await libraryGetJobStatus(jobId); const job = current.data.job as LibraryJobData["job"];
            if (job?.status === "failed") throw new Error(job.error || job.result?.error || lt("reportFailed"));
            if (job?.status === "completed") break;
        }
        const response = await fetch(`/library/vocabulary-report/${encodeURIComponent(jobId)}/download`);
        if (!response.ok) throw new Error(lt("reportFailed"));
        const blob = await response.blob(); const disposition = response.headers.get("Content-Disposition") || "";
        const filename = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || "vocabulary_report.xlsx");
        const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
        if (status) status.textContent = lt("reportReady");
    } catch (error) {
        const message = error instanceof Error ? error.message : lt("reportFailed"); if (status) status.textContent = message; throw error;
    } finally { button.disabled = false; button.textContent = lt("prepareReport"); }
}

function bindVocabularyReportController() {
    const modal = document.getElementById("vocabularyReportModal"); const open = document.getElementById("exportVocabularyBtn");
    const close = () => modal?.classList.add("hidden");
    open?.addEventListener("click", () => modal?.classList.remove("hidden"));
    document.getElementById("closeVocabularyReportBtn")?.addEventListener("click", close);
    document.getElementById("cancelVocabularyReportBtn")?.addEventListener("click", close);
    document.getElementById("confirmVocabularyReportBtn")?.addEventListener("click", () => { if (currentOpenedSeries) downloadVocabularyReport(currentOpenedSeries.id).catch(() => undefined); });
}
