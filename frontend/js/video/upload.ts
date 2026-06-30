async function uploadVideoInBackground(videoFile: File, subtitleFile: File | null = null): Promise<void> {
    const form = new FormData();
    form.append("videoFile", videoFile);

    try {
        const { data } = await apiJson<CurrentVideoResponse>("/upload-video", {
            method: "POST",
            body: form
        });

        if (data.error) {
            console.error("Server upload error:", data.error);
            showToast(t("toastVideoUploadFailed", { message: getApiErrorMessage(data) }), "error", 5000);
            return;
        }

        if (!data.filename) return;

        currentVideoFile = data.filename;
        loadAudioTrackList(data.filename);

        if (subtitleFile) {
            await uploadSubtitleInBackground(subtitleFile, data.filename);
        }

    } catch (e) {
        console.error("Upload failed:", e);
        showToast(t("toastVideoUploadFailed", { message: e.message }), "error", 5000);
    }
}

async function uploadSubtitleInBackground(subtitleFile: File, videoFilename: string): Promise<void> {
    const form = new FormData();

    form.append("subtitleFile", subtitleFile);
    form.append("videoFilename", videoFilename);

    try {
        const { data } = await apiJson<CurrentVideoResponse>("/upload-subtitle", {
            method: "POST",
            body: form
        });

        if (data.error) {
            console.error("Subtitle upload error:", data.error);
            showToast(t("toastSubtitleUploadFailed", { message: getApiErrorMessage(data) }), "error", 5000);
            return;
        }

        console.log("Subtitle uploaded:", data.filename);

        // Р’РђР–РќРћ:
        // СЃРµСЂРІРµСЂ РІРµСЂРЅСѓР» СѓР¶Рµ .srt, РґР°Р¶Рµ РµСЃР»Рё РЅР° РІС…РѕРґ Р±С‹Р» .ass
        if (data.filename) {
            await restoreSubtitleFromServer(data.filename);
        }

    } catch (err) {
        console.error("Subtitle upload failed:", err);
        showToast(t("toastSubtitleUploadFailed", { message: err.message }), "error", 5000);
    }
}

async function restoreSubtitleFromServer(subtitleFilename: string): Promise<void> {
    try {
        const res = await fetch(buildApiUrl(`/subtitle/${encodeURIComponent(subtitleFilename)}`));

        if (!res.ok) {
            throw new Error(`Subtitle load failed: HTTP ${res.status}`);
        }

        const text = await res.text();
        const lowerName = subtitleFilename.toLowerCase();

        if (lowerName.endsWith(".srt")) {
            subtitles = parseSRT(text);
        }  else {
            throw new Error("Unsupported subtitle format");
        }

        lastRuntimeSubtitleText = "";
        runtimePrefetchAllRunId += 1;
		runtimeHighlightPrefetchReady = false;

        clearRuntimeWordStatuses?.();

        renderSubtitles();

        requestAnimationFrame(() => {
            prefetchRuntimeStatusesForAllSubtitles({ silent: true });
        });

        showToast(t("toastVideoAndSubtitlesRestored"), "info", 2500);
    } catch (err) {
        console.error("Could not restore subtitles:", err);
        showToast(t("toastVideoRestoredSubtitlesFailed"), "error", 5000);
    }
}
