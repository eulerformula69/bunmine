class AudioTrackManager {
    constructor(videoEl) {
        this.video = videoEl;
        this.originalSource = "";
        this.currentTrack = "default";
    }
    async setTrack(trackId, videoPayload) {
        if (trackId === "default") {
            if (this.originalSource)
                await this.replaceSource(this.originalSource);
            this.currentTrack = "default";
            return;
        }
        if (!videoPayload) {
            showToast("Video is not selected", "error", 5000);
            return;
        }
        try {
            const { data } = await apiJson("/get-track-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...videoPayload,
                    trackIndex: trackId
                })
            });
            if (data.error) {
                throw new Error(getApiErrorMessage(data));
            }
            if (!this.originalSource)
                this.originalSource = this.video.currentSrc || this.video.src;
            await this.replaceSource(buildApiUrl(data.url || ""));
            this.currentTrack = trackId;
        }
        catch (e) {
            console.error("Track switch error:", e);
            showToast("Could not switch audio track", "error", 5000);
        }
    }
    async replaceSource(source) {
        const time = this.video.currentTime;
        const wasPlaying = !this.video.paused;
        const playbackRate = this.video.playbackRate;
        this.video.src = source;
        this.video.load();
        await new Promise((resolve, reject) => {
            this.video.addEventListener("loadedmetadata", () => resolve(), { once: true });
            this.video.addEventListener("error", () => reject(new Error("Media stream failed to load")), { once: true });
        });
        this.video.currentTime = Math.min(time, this.video.duration || time);
        this.video.playbackRate = playbackRate;
        if (wasPlaying)
            await this.video.play();
    }
    resetSource(source) {
        this.originalSource = source || this.video.src || this.video.currentSrc;
        this.currentTrack = "default";
    }
}
const audioManager = new AudioTrackManager(video);
volume.oninput = () => {
    video.volume = Number(volume.value);
};
async function loadAudioTrackList(videoRef) {
    try {
        audioManager.resetSource();
        const query = typeof videoRef === "object" && videoRef?.videoFileId
            ? `videoFileId=${encodeURIComponent(videoRef.videoFileId)}`
            : `filename=${encodeURIComponent(String(videoRef))}`;
        const { data } = await apiJson(`/get-audio-tracks?${query}`);
        audioTrackSelect.innerHTML = "";
        if (data.tracks && data.tracks.length > 1) {
            data.tracks.forEach((track, index) => {
                const lang = (track.tags?.language || `Track ${index + 1}`).toUpperCase();
                const title = track.tags?.title ? ` (${track.tags.title})` : "";
                const opt = document.createElement("option");
                opt.value = index === 0 ? "default" : String(track.index);
                opt.textContent = `${lang}${title}`;
                audioTrackSelect.appendChild(opt);
            });
        }
        else {
            const opt = document.createElement("option");
            opt.value = "default";
            opt.textContent = "Original Audio";
            audioTrackSelect.appendChild(opt);
        }
    }
    catch (e) {
        console.error("Track load error:", e);
        audioTrackSelect.innerHTML = '<option value="default">DEFAULT</option>';
    }
}
audioTrackSelect.onchange = () => {
    audioManager.setTrack(audioTrackSelect.value, getCurrentVideoPayload());
};
video.addEventListener("play", () => {
    updatePlayButton();
});
video.addEventListener("pause", updatePlayButton);
function getValidatedVolume() {
    const input = document.getElementById("audioVol");
    let val = parseFloat(input.value);
    if (val < 0)
        val = 0;
    if (val > 2)
        val = 2;
    input.value = String(val);
    return val;
}
document.getElementById("previewAudioBtn")?.addEventListener("click", async () => {
    const videoPayload = getCurrentVideoPayload();
    if (!videoPayload) {
        return showToast("Video is not selected", "error", 6000);
    }
    const offsetStart = parseFloat(document.getElementById("subOffsetStart").value) || 0;
    const offsetEnd = parseFloat(document.getElementById("subOffsetEnd").value) || 0;
    const volumeLevel = parseFloat(document.getElementById("audioVol").value) || 1;
    const currentIdx = subtitles.findIndex((s) => (video.currentTime - globalSubDelay) >= s.start && (video.currentTime - globalSubDelay) <= s.end);
    if (currentIdx === -1)
        return showToast("No active subtitle", "error", 6000);
    const contextSelection = getSubtitleContextSelection(currentIdx);
    const start = Math.max(0, contextSelection.startTime + globalSubDelay + offsetStart);
    let end = contextSelection.endTime + globalSubDelay + offsetEnd;
    if (end <= start)
        end = start + 0.5;
    try {
        const { data } = await apiJson("/audio-to-anki", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...videoPayload,
                start,
                end,
                trackIndex: audioTrackSelect.value === "default" ? "a:0" : audioTrackSelect.value,
                volume: volumeLevel
            })
        });
        if (data.url) {
            const audioUrl = `${buildApiUrl(data.url)}&t=${Date.now()}`;
            const audio = new Audio(audioUrl);
            audio.volume = Math.min(1.0, Math.max(0.0, volumeLevel));
            audio.play();
        }
        else {
            showToast("Server error: " + getApiErrorMessage(data), "error", 6000);
        }
    }
    catch (err) {
        console.error("Preview failed:", err);
        alert("Error: " + err.message);
    }
});
