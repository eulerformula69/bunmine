class AudioTrackManager {
    video: HTMLVideoElement;
    externalAudio: HTMLAudioElement | null;
    currentTrack: string;

    constructor(videoEl: HTMLVideoElement) {
        this.video = videoEl;
        this.externalAudio = null;
        this.currentTrack = "default";
    }

	async setTrack(trackId: string, videoPayload: CurrentVideoPayload | null): Promise<void> {
		if (trackId === "default") {
			this.destroyExternal();
			this.video.muted = false;
			this.currentTrack = "default";
			return;
		}

		if (!videoPayload) {
			showToast("Video is not selected", "error", 5000);
			return;
		}

		try {
			const { data } = await apiJson<TrackUrlResponse>("/get-track-url", {
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

            this.destroyExternal();
            this.externalAudio = document.createElement("audio");
            this.externalAudio.preload = "auto";
            this.externalAudio.src = data.url || "";
            this.sync();
            this.video.muted = true;
            this.currentTrack = trackId;
        } catch (e) {
            console.error("Track switch error:", e);
        }
    }

    sync(): void {
        if (!this.externalAudio) return;
        const v = this.video;
        const a = this.externalAudio;
        a.currentTime = v.currentTime;
        a.playbackRate = v.playbackRate;
        a.volume = v.volume;
        if (!v.paused) a.play().catch(() => {});
    }

    pause(): void {
        if (this.externalAudio) this.externalAudio.pause();
    }

    destroyExternal(): void {
        if (!this.externalAudio) return;
        this.externalAudio.pause();
        this.externalAudio = null;
    }
}

const audioManager = new AudioTrackManager(video);

volume.oninput = () => {
    video.volume = Number(volume.value);
    if (audioManager.externalAudio) audioManager.externalAudio.volume = Number(volume.value);
};

async function loadAudioTrackList(videoRef: string | { videoFileId: string | number }): Promise<void> {
    try {
        const query = typeof videoRef === "object" && videoRef?.videoFileId
            ? `videoFileId=${encodeURIComponent(videoRef.videoFileId)}`
            : `filename=${encodeURIComponent(String(videoRef))}`;

        const { data } = await apiJson<AudioTracksResponse>(`/get-audio-tracks?${query}`);
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
        } else {
            const opt = document.createElement("option");
            opt.value = "default";
            opt.textContent = "Original Audio";
            audioTrackSelect.appendChild(opt);
        }
    } catch (e) {
        console.error("Track load error:", e);
        audioTrackSelect.innerHTML = '<option value="default">DEFAULT</option>';
    }
}

audioTrackSelect.onchange = () => {
    audioManager.setTrack(
        audioTrackSelect.value,
        getCurrentVideoPayload()
    );
};

video.addEventListener("play", () => {
    audioManager.sync();
    updatePlayButton();
});

video.addEventListener("pause", () => {
    audioManager.pause();
    updatePlayButton();
});

video.addEventListener("seeking", () => {
    audioManager.sync();
});

video.addEventListener("ratechange", () => {
    audioManager.sync();
});

function getValidatedVolume(): number {
    const input = document.getElementById("audioVol") as HTMLInputElement;
    let val = parseFloat(input.value);
    if (val < 0) val = 0;
    if (val > 2) val = 2;
    input.value = String(val);
    return val;
}

document.getElementById("previewAudioBtn")?.addEventListener("click", async () => {
    const videoPayload = getCurrentVideoPayload();

    if (!videoPayload) {
        return showToast("Video is not selected", "error", 6000);
    }

    const offsetStart = parseFloat((document.getElementById("subOffsetStart") as HTMLInputElement).value) || 0;
    const offsetEnd = parseFloat((document.getElementById("subOffsetEnd") as HTMLInputElement).value) || 0;
    const volumeLevel = parseFloat((document.getElementById("audioVol") as HTMLInputElement).value) || 1;

	const currentIdx = subtitles.findIndex((s) => (video.currentTime - globalSubDelay) >= s.start && (video.currentTime - globalSubDelay) <= s.end);
	if (currentIdx === -1) return showToast("No active subtitle", "error", 6000);

	const contextSelection = getSubtitleContextSelection(currentIdx);

	const start = Math.max(
		0,
		contextSelection.startTime + globalSubDelay + offsetStart
	);

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
				trackIndex: audioTrackSelect.value === "default" ? "a:0" : audioTrackSelect.value,
				volume: volumeLevel
            })
        });

        if (data.url) {
            const audioUrl = `${buildApiUrl(data.url)}&t=${Date.now()}`;
            const audio = new Audio(audioUrl);
            audio.volume = Math.min(1.0, Math.max(0.0, volumeLevel));
            audio.play();
        } else {
			showToast("Server error: " + getApiErrorMessage(data), "error", 6000);
        }
    } catch (err) {
        console.error("Preview failed:", err);
        alert("Error: " + err.message);
    }
});





