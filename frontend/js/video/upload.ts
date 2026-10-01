import { apiJson, buildApiUrl, getApiErrorMessage } from "../core/api.js";
import { CurrentVideoResponse } from "../types/api.js";
import { showToast, t } from "../player/ui.js";
import { state } from "../core/state.js";
import { parseSubtitleSource } from "../subtitles/parse-subtitle-source.js";
import { detectSubtitleFormat } from "../subtitles/format-detection.js";
import { toRuntimeSubtitleCues } from "../subtitles/model.js";
import { clearRuntimeWordStatuses } from "../highlighter/anki-highlighter.js";
import { renderSubtitles } from "../subtitles/sidebar-render.js";
import { prefetchRuntimeStatusesForAllSubtitles } from "../player/app.js";
export async function uploadVideoInBackground(videoFile: File, subtitleFile: File | null = null): Promise<void> {
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

        state.currentVideoFile = data.filename;
        if (subtitleFile) {
            await uploadSubtitleInBackground(subtitleFile, data.filename);
        }

    } catch (e) {
        console.error("Upload failed:", e);
        showToast(t("toastVideoUploadFailed", { message: e.message }), "error", 5000);
    }
}

export async function uploadSubtitleInBackground(subtitleFile: File, videoFilename: string): Promise<void> {
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
        if (data.filename) {
            await restoreSubtitleFromServer(data.filename);
        }

    } catch (err) {
        console.error("Subtitle upload failed:", err);
        showToast(t("toastSubtitleUploadFailed", { message: err.message }), "error", 5000);
    }
}

export async function restoreSubtitleFromServer(subtitleFilename: string): Promise<void> {
    try {
        const res = await fetch(buildApiUrl(`/subtitle/${encodeURIComponent(subtitleFilename)}`));

        if (!res.ok) {
            throw new Error(`Subtitle load failed: HTTP ${res.status}`);
        }

        const text = await res.text();
        const parsed = await parseSubtitleSource({
            source: text,
            format: detectSubtitleFormat({ filename: subtitleFilename, source: text }),
            filename: subtitleFilename
        });
        state.subtitles = toRuntimeSubtitleCues(parsed.cues);

        state.lastRuntimeSubtitleText = "";
        state.runtimePrefetchAllRunId += 1;
		state.runtimeHighlightPrefetchReady = false;

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
