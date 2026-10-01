import { ApiPayload } from "../types/api.js";
import { getApiErrorMessage } from "../core/api.js";
import { requestWithRetry, RetryOptions } from "../core/rate-limit.js";

export async function requestSubtitleWithRetry<T extends ApiPayload>(
    request: () => Promise<{response: Response; data: T}>,
    options: RetryOptions & {failureMessage: string}
): Promise<T> {
    const {response, data} = await requestWithRetry(request, options);
    if (!response.ok || data.error) throw new Error(getApiErrorMessage(data, options.failureMessage));
    return data;
}
