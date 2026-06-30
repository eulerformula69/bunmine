function libraryListSeries(): Promise<ApiResult<LibrarySeriesListResponse>> {
    return apiJson<LibrarySeriesListResponse>("/library/series");
}

function libraryChooseFolder(initialPath = ""): Promise<ApiResult<LibraryFolderDialogResponse>> {
    return apiJson<LibraryFolderDialogResponse>("/library/dialog/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialPath })
    });
}

function libraryStartJob(
    requestPath: string,
    requestOptions: RequestInit = {}
): Promise<ApiResult<JobResponse>> {
    return apiJson<JobResponse>(requestPath, requestOptions);
}

function libraryGetJobStatus(jobId: string): Promise<ApiResult<LibraryJobStatusResponse>> {
    return apiJson<LibraryJobStatusResponse>(`/library/jobs/${encodeURIComponent(jobId)}`);
}

function libraryGetSeries(seriesId: string | number): Promise<ApiResult<LibrarySeriesDetailResponse>> {
    return apiJson<LibrarySeriesDetailResponse>(`/library/series/${encodeURIComponent(seriesId)}`);
}

function libraryGetEpisodePlayback(episodeId: string | number): Promise<ApiResult<LibraryPlaybackResponse>> {
    return apiJson<LibraryPlaybackResponse>(`/library/episodes/${encodeURIComponent(episodeId)}/playback`);
}

function libraryPostEpisodeProgress(
    episodeId: string | number,
    payload: Record<string, unknown>
): Promise<ApiResult<LibraryProgressPayload>> {
    return apiJson<LibraryProgressPayload>(`/library/episodes/${encodeURIComponent(episodeId)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

function librarySetEpisodeCompleted(
    episodeId: string | number,
    completed: boolean
): Promise<ApiResult<LibraryMutationResponse>> {
    return apiJson<LibraryMutationResponse>(`/library/episodes/${encodeURIComponent(episodeId)}/completed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed })
    });
}

function libraryDeleteSeries(seriesId: string | number): Promise<ApiResult<LibraryMutationResponse>> {
    return apiJson<LibraryMutationResponse>(`/library/series/${encodeURIComponent(seriesId)}`, {
        method: "DELETE"
    });
}

function libraryRelinkSeries(
    seriesId: string | number,
    payload: Record<string, unknown>
): Promise<ApiResult<LibraryMutationResponse>> {
    return apiJson<LibraryMutationResponse>(`/library/series/${encodeURIComponent(seriesId)}/relink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

function librarySearchEpisodeSubtitles(
    episodeId: string | number,
    query: string
): Promise<ApiResult<LibrarySubtitleSearchResponse>> {
    return apiJson<LibrarySubtitleSearchResponse>(
        `/library/episodes/${encodeURIComponent(episodeId)}/subtitles/search?q=${encodeURIComponent(query)}`
    );
}

function librarySelectEpisodeSubtitle(
    episodeId: string | number,
    payload: Record<string, unknown>
): Promise<ApiResult<LibraryMutationResponse>> {
    return apiJson<LibraryMutationResponse>(`/library/episodes/${encodeURIComponent(episodeId)}/subtitles/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

function libraryAnalyzeSeriesSubtitles(
    seriesId: string | number,
    query: string
): Promise<ApiResult<LibrarySubtitlePlanResponse>> {
    return apiJson<LibrarySubtitlePlanResponse>(`/library/series/${encodeURIComponent(seriesId)}/subtitles/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
}

function libraryPlanEpisodeSubtitle(
    episodeId: string | number,
    query: string
): Promise<ApiResult<LibrarySubtitlePlanResponse>> {
    return apiJson<LibrarySubtitlePlanResponse>(`/library/episodes/${encodeURIComponent(episodeId)}/subtitles/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
}

function librarySearchSeriesCover(
    seriesId: string | number,
    query: string
): Promise<ApiResult<LibraryCoverSearchResponse>> {
    return apiJson<LibraryCoverSearchResponse>(
        `/library/series/${encodeURIComponent(seriesId)}/cover/search?q=${encodeURIComponent(query)}`
    );
}

function librarySelectSeriesCover(
    seriesId: string | number,
    payload: Record<string, unknown>
): Promise<ApiResult<LibraryMutationResponse>> {
    return apiJson<LibraryMutationResponse>(`/library/series/${encodeURIComponent(seriesId)}/cover/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
