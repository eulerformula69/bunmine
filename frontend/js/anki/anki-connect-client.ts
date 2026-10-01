import { requestWithRetry } from "../core/rate-limit.js";

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
        let response: Response;
        try {
            ({response} = await requestWithRetry(async () => ({response: await fetch(url, request)}), {
                networkRetries: Math.max(0, (options.retries ?? 3) - 1),
                retries: options.retries === 0 ? 0 : undefined,
                delayMs: 1000, signal: controller.signal,
                exhaustedMessage: options.label || `AnkiConnect ${action}`,
            }));
        } catch (error) {
            if (controller.signal.aborted || options.retries === 0) throw error;
            const label = options.label || `AnkiConnect ${action}`;
            const message = error instanceof Error ? error.message : String(error || "Unknown error");
            throw new Error(`${label} failed. Make sure Anki is open and AnkiConnect is installed. Details: ${message}`);
        }
        const data = await response.json() as { result: T; error?: string };
        if (data.error || !response.ok) {
            throw new Error(data.error || `Anki update failed: HTTP ${response.status}`);
        }
        return data.result;
    } finally {
        clearTimeout(timer);
    }
}
