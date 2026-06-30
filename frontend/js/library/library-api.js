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
