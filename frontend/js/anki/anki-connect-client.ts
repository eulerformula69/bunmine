import { fetchWithRetry } from "../core/api.js";

export async function ankiRequest<T>(
    url: string,
    action: string,
    params: Record<string, unknown> = {},
    options: { retries?: number; timeoutMs?: number; label?: string } = {}
): Promise<T> {
    const controller = new AbortController();
    const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
    const request: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: 6, params }),
        signal: controller.signal
    };
    try {
        const response = options.retries === 0
            ? await fetch(url, request)
            : await fetchWithRetry(url, request, {
                retries: options.retries ?? 3, delayMs: 1000,
                label: options.label || `AnkiConnect ${action}`
            });
        const data = await response.json() as { result: T; error?: string };
        if (data.error || !response.ok) {
            throw new Error(data.error || `Anki update failed: HTTP ${response.status}`);
        }
        return data.result;
    } finally {
        clearTimeout(timer);
    }
}
