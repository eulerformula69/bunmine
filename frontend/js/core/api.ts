import { ApiPayload,ApiResult } from "../types/api.js";

export const API_BASE = window.location.origin;

export function buildApiUrl(path: string): string {
    return `${API_BASE}${path}`;
}

export async function apiJson<T extends ApiPayload = ApiPayload>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResult<T>> {
    const response = await fetch(buildApiUrl(path), options);
    const responseText = await response.text();
    let data: T;

    try {
        data = (responseText ? JSON.parse(responseText) : {}) as T;
    } catch {
        const status = `${response.status} ${response.statusText}`.trim();
        data = {
            error: status || "Server returned an invalid response"
        } as T;
    }

    normalizeApiPayload(data);
    return { response, data };
}

export function normalizeApiPayload<T extends ApiPayload>(data: T): T {
    if (!data || typeof data !== "object") return data;

    if (data.ok === false && data.error && typeof data.error === "object") {
        data.errorInfo = data.error;
        data.error = data.error.message || "Request failed";
    }

    return data;
}

export function getApiErrorMessage(data: ApiPayload | null | undefined, fallback = "Request failed"): string {
    if (!data || typeof data !== "object") return fallback;
    if (typeof data.error === "string" && data.error) return data.error;
    if (data.error && typeof data.error === "object" && data.error.message) return data.error.message;
    if (data.errorInfo?.message) return data.errorInfo.message;
    return fallback;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
