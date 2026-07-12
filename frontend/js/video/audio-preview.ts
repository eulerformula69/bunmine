function getValidatedVolume(): number {
    const input = document.getElementById("audioVol") as HTMLInputElement;
    let value = parseFloat(input.value);
    if (value < 0) value = 0;
    if (value > 2) value = 2;
    input.value = String(value);
    return value;
}

document.getElementById("previewAudioBtn")?.addEventListener("click", async () => {
    const videoPayload = getCurrentVideoPayload();
    if (!videoPayload) {
        return showToast("Video is not selected", "error", 6000);
    }

    const offsetStart = parseFloat((document.getElementById("subOffsetStart") as HTMLInputElement).value) || 0;
    const offsetEnd = parseFloat((document.getElementById("subOffsetEnd") as HTMLInputElement).value) || 0;
    const volumeLevel = parseFloat((document.getElementById("audioVol") as HTMLInputElement).value) || 1;
    const adjustedTime = video.currentTime - globalSubDelay;
    const currentIdx = subtitles.findIndex((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end);
    if (currentIdx === -1) return showToast("No active subtitle", "error", 6000);

    const contextSelection = getSubtitleContextSelection(currentIdx);
    const start = Math.max(0, contextSelection.startTime + globalSubDelay + offsetStart);
    let end = contextSelection.endTime + globalSubDelay + offsetEnd;
    if (end <= start) end = start + 0.5;

    try {
        const { data } = await apiJson<MediaExportResponse>("/audio-to-anki", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...videoPayload,
                start,
                end,
                trackIndex: "a:0",
                volume: volumeLevel
            })
        });

        if (!data.url) {
            showToast("Server error: " + getApiErrorMessage(data), "error", 6000);
            return;
        }

        const audio = new Audio(`${buildApiUrl(data.url)}&t=${Date.now()}`);
        audio.volume = Math.min(1, Math.max(0, volumeLevel));
        audio.play();
    } catch (err) {
        console.error("Preview failed:", err);
        showToast(`Audio preview failed: ${err.message}`, "error", 6000);
    }
});
