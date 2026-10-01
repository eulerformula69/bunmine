import { apiJson,getApiErrorMessage } from "../core/api.js";

import { MiningCandidate } from "./candidate-model.js";

import { AnkiMediaSnapshot } from "../anki/media-snapshot.js";

import { CandidateContext } from "./candidate-context-model.js";
import { ApiPayload } from "../types/api.js";

interface CandidateResponse extends ApiPayload { candidate: MiningCandidate }
interface CandidatesResponse extends ApiPayload { candidates: MiningCandidate[] }
interface CandidateActionResponse extends ApiPayload { token?: string; ankiNoteId?: number | null }

export async function candidateRequest<T extends ApiPayload = ApiPayload>(path = "", body?: object): Promise<T> {
    const { response, data } = await apiJson<T>(`/mining-candidates${path}`, body === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok || !data || data.error) throw new Error(getApiErrorMessage(data));
    return data;
}

export const candidateApi = {
    list: async (): Promise<MiningCandidate[]> => (await candidateRequest<CandidatesResponse>()).candidates,
    capture: async (snapshot: AnkiMediaSnapshot): Promise<MiningCandidate> =>
        (await candidateRequest<CandidateResponse>("", { snapshot })).candidate,
    source: async (id: number): Promise<MiningCandidate> => (await candidateRequest<CandidateResponse>(`/${id}/source`)).candidate,
    action: (id: number, action: string, token?: string, noteId?: number, revision?: number): Promise<CandidateActionResponse> =>
        candidateRequest(`/${id}/${action}`, { token, noteId, revision }),
    context: async (candidate: MiningCandidate, context: CandidateContext, start: number, end: number): Promise<MiningCandidate> =>
        (await candidateRequest<CandidateResponse>(`/${candidate.id}/context`, { context, start, end, revision: candidate.revision })).candidate,
};
