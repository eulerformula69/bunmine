let episodeNavigationRevision = 0;

function resetEpisodeNavigation(): void {
    episodeNavigationRevision += 1;
    document.getElementById("episodeNavigation").hidden = true;
    document.getElementById("nextEpisodeLink").hidden = true;
}

async function updateEpisodeNavigation(playback: LibraryPlaybackPayload): Promise<void> {
    resetEpisodeNavigation();
    if (!playback.seriesId || !playback.episodeId) return;
    const revision = episodeNavigationRevision;
    const navigation = document.getElementById("episodeNavigation");
    const allEpisodes = document.getElementById("allEpisodesLink") as HTMLAnchorElement;
    const nextEpisode = document.getElementById("nextEpisodeLink") as HTMLAnchorElement;
    allEpisodes.href = `/library-page#series=${encodeURIComponent(playback.seriesId)}`;
    allEpisodes.title = playback.seriesTitle || "";
    navigation.hidden = false;

    try {
        const { response, data } = await apiJson<LibrarySeriesDetailResponse>(
            `/library/series/${encodeURIComponent(playback.seriesId)}`
        );
        if (revision !== episodeNavigationRevision) return;
        if (!response.ok || data.error) throw new Error("Could not load episode navigation");
        const episodes = data.episodes || [];
        const index = episodes.findIndex((episode) => String(episode.id) === String(playback.episodeId));
        const next = index >= 0 ? episodes[index + 1] : undefined;
        // Keep the library order and never skip an episode with a missing video.
        if (!next?.hasVideo) return;
        nextEpisode.href = `/?episodeId=${encodeURIComponent(next.id)}`;
        nextEpisode.title = next.title || "";
        nextEpisode.hidden = false;
    } catch (error) {
        console.warn("Could not load episode navigation:", error);
    }
}
