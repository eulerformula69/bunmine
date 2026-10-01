import { logger } from "../core/logger.js";
import { requiredElement } from "../core/dom.js";
import { LibraryPlaybackPayload } from "../types/runtime-types.js";

import { apiJson } from "../core/api.js";

import { LibrarySeriesDetailResponse } from "../types/api.js";

export const episodeNavigationRevisionState = { value: 0 };

export function resetEpisodeNavigation(): void {
    episodeNavigationRevisionState.value += 1;
    requiredElement(document.getElementById("episodeNavigation")).hidden = true;
    requiredElement(document.getElementById("nextEpisodeLink") as HTMLAnchorElement | null).hidden = true;
}

export async function updateEpisodeNavigation(playback: LibraryPlaybackPayload): Promise<void> {
    resetEpisodeNavigation();
    if (!playback.seriesId || !playback.episodeId) return;
    const revision = episodeNavigationRevisionState.value;
    const navigation = requiredElement(document.getElementById("episodeNavigation"));
    const allEpisodes = document.getElementById("allEpisodesLink") as HTMLAnchorElement;
    const nextEpisode = requiredElement(document.getElementById("nextEpisodeLink") as HTMLAnchorElement | null) as HTMLAnchorElement;
    allEpisodes.href = `/library-page#series=${encodeURIComponent(playback.seriesId)}`;
    allEpisodes.title = playback.seriesTitle || "";
    navigation.hidden = false;

    try {
        const { response, data } = await apiJson<LibrarySeriesDetailResponse>(
            `/library/series/${encodeURIComponent(playback.seriesId)}`
        );
        if (revision !== episodeNavigationRevisionState.value) return;
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
        logger.warn("Could not load episode navigation:", error);
    }
}
