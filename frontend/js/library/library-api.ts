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
