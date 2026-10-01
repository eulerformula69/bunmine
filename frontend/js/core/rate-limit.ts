import { ApiPayload } from "../types/api.js";
import { abortableDelay } from "./async-work.js";

export function retryAfterToMs(value: unknown, fallback = 12000, now = Date.now()): number {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
    const date = Date.parse(raw);
    return Number.isFinite(date) ? Math.max(1000, date - now) : fallback;
}

export async function retryOnRateLimit<T extends ApiPayload>(
    request: () => Promise<{response: Response; data: T}>,
    options: {
        failureMessage: string;
        exhaustedMessage: string;
        onWait(milliseconds: number): void;
        retries?: number;
        wait?: (milliseconds: number) => Promise<void>;
        signal?: AbortSignal;
    }
): Promise<T> {
    for (let attempt = 0; attempt <= (options.retries ?? 4); attempt++) {
        options.signal?.throwIfAborted();
        const {response, data} = await request();
        if (response.status !== 429) {
            if (!response.ok || data.error) throw new Error(String(data.error || options.failureMessage));
            return data;
        }
        const delay = retryAfterToMs(data.retryAfter);
        options.onWait(delay);
        if (options.wait) await options.wait(delay);
        else await abortableDelay(delay, options.signal);
    }
    throw new Error(options.exhaustedMessage);
}
