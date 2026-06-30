function libraryListSeries() {
    return apiJson("/library/series");
}
function libraryChooseFolder(initialPath = "") {
    return apiJson("/library/dialog/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialPath })
    });
}
function libraryStartJob(requestPath, requestOptions = {}) {
    return apiJson(requestPath, requestOptions);
}
function libraryGetJobStatus(jobId) {
    return apiJson(`/library/jobs/${encodeURIComponent(jobId)}`);
}
function libraryGetSeries(seriesId) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}`);
}
function libraryGetEpisodePlayback(episodeId) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/playback`);
}
function libraryPostEpisodeProgress(episodeId, payload) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
function librarySetEpisodeCompleted(episodeId, completed) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/completed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed })
    });
}
function libraryDeleteSeries(seriesId) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}`, {
        method: "DELETE"
    });
}
function libraryRelinkSeries(seriesId, payload) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}/relink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
function librarySearchEpisodeSubtitles(episodeId, query) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/subtitles/search?q=${encodeURIComponent(query)}`);
}
function librarySelectEpisodeSubtitle(episodeId, payload) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/subtitles/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
function libraryAnalyzeSeriesSubtitles(seriesId, query) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}/subtitles/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
}
function libraryPlanEpisodeSubtitle(episodeId, query) {
    return apiJson(`/library/episodes/${encodeURIComponent(episodeId)}/subtitles/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
}
function librarySearchSeriesCover(seriesId, query) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}/cover/search?q=${encodeURIComponent(query)}`);
}
function librarySelectSeriesCover(seriesId, payload) {
    return apiJson(`/library/series/${encodeURIComponent(seriesId)}/cover/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
