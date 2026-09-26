async function candidateRequest(path = "", body?: object): Promise<any> {
    const { response, data } = await apiJson(`/mining-candidates${path}`, body === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok || !data || data.error) throw new Error(getApiErrorMessage(data));
    return data;
}

const candidateApi = {
    list: async (): Promise<MiningCandidate[]> => (await candidateRequest()).candidates,
    capture: async (snapshot: AnkiMediaSnapshot): Promise<MiningCandidate> =>
        (await candidateRequest("", { snapshot })).candidate,
    source: async (id: number): Promise<MiningCandidate> => (await candidateRequest(`/${id}/source`)).candidate,
    action: (id: number, action: string, token?: string, noteId?: number): Promise<any> =>
        candidateRequest(`/${id}/${action}`, { token, noteId }),
};
