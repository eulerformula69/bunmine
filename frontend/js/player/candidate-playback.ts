async function playCandidateSource(candidate: MiningCandidate): Promise<MiningCandidate> {
    candidate = await candidateApi.source(candidate.id);
    const payload = candidate.snapshot.videoPayload;
    video.pause();
    await saveLibraryWatchProgress({ force: true, skipAutoCompletePrompt: true });
    if (JSON.stringify(payload) !== JSON.stringify(getCurrentVideoPayload())) {
        if ("videoFileId" in payload && candidate.episode_id) {
            const { response, data } = await apiJson<LibraryPlaybackPayload>(
                `/library/episodes/${candidate.episode_id}/playback`
            );
            if (!response.ok || data.error) throw new Error(getApiErrorMessage(data));
            await loadLibraryEpisodePlayback({ ...data, videoFileId: payload.videoFileId,
                videoUrl: `/library/file/${payload.videoFileId}`, currentTimeSeconds: candidate.snapshot.targetTime });
        } else if ("filename" in payload) {
            currentLibraryEpisodeId = null;
            currentLibraryVideoFileId = null;
            currentLibrarySubtitleFileId = null;
            resetEpisodeNavigation();
            const { data } = await apiJson<VideoListResponse>("/videos");
            const info = data.videos?.find((item) => item.filename === payload.filename);
            if (!info) throw new Error(t("candidateSourceMissing"));
            await restoreSelectedVideoFromServer(info);
        } else {
            throw new Error(t("candidateEpisodeMissing"));
        }
    }
    if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                video.removeEventListener("loadedmetadata", ready);
                video.removeEventListener("error", failed);
            };
            const ready = () => { cleanup(); resolve(); };
            const failed = () => { cleanup(); reject(new Error(t("candidateVideoFailed"))); };
            const timer = setTimeout(failed, 15000);
            video.addEventListener("loadedmetadata", ready, { once: true });
            video.addEventListener("error", failed, { once: true });
        });
    }
    video.currentTime = candidate.snapshot.targetTime;
    resetLibraryProgressTracking();
    return candidate;
}
