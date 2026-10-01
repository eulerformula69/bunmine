import type { LibraryPlaybackPayload } from "./types/runtime-types.js";
{
    const startEarlyLibraryPlayback = (): Promise<LibraryPlaybackPayload | null> => {
        const episodeId = new URLSearchParams(window.location.search).get("episodeId");
        if (!episodeId) return Promise.resolve(null);

        return fetch(`/library/episodes/${encodeURIComponent(episodeId)}/playback`)
            .then(async (response) => {
                const data = await response.json() as LibraryPlaybackPayload;
                if (!response.ok || data.error) return data;

                const video = document.getElementById("video") as HTMLVideoElement | null;
                if (video && data.videoUrl) {
                    const startTime = Number(data.currentTimeSeconds || 0);
                    const restorePlaybackTime = () => {
                        if (startTime > 0 && startTime < video.duration) {
                            video.currentTime = startTime;
                        }
                    };

                    video.addEventListener("loadedmetadata", restorePlaybackTime, { once: true });
                    video.preload = "auto";
                    video.src = data.videoUrl;
                    video.load();
                    document.getElementById("dropzone")?.classList.add("hidden");
                }
                return data;
            });
    };

    window.BunmineEarlyLibraryPlayback = startEarlyLibraryPlayback();

    import("./player/entry.js").then(() => {
        if (document.readyState === "complete") window.dispatchEvent(new Event("load"));
    }).catch(console.error);
}
