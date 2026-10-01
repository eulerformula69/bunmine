import { ApiPayload } from "../types/api.js";
import { abortableDelay } from "./async-work.js";

export const JIMAKU_PLAN_REQUEST_DELAY_MS = 1300;
export const JIMAKU_429_DEFAULT_WAIT_MS = 12000;
export const JIMAKU_429_MAX_RETRIES = 4;
export const JIMAKU_DOWNLOAD_CONCURRENCY = 2;

export function retryAfterToMs(value: unknown, fallback = JIMAKU_429_DEFAULT_WAIT_MS, now = Date.now()): number {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
    const date = Date.parse(raw);
    return Number.isFinite(date) ? Math.max(1000, date - now) : fallback;
}

export interface RetryOptions {
    retries?: number;
    networkRetries?: number;
    delayMs?: number;
    exhaustedMessage: string;
    onWait?(milliseconds: number): void;
    wait?: (milliseconds: number) => Promise<void>;
    signal?: AbortSignal;
}

export async function requestWithRetry<T extends {response: Response; data?: ApiPayload}>(
    request: () => Promise<T>, options: RetryOptions
): Promise<T> {
    let rateLimits = 0;
    let networkErrors = 0;
    const wait = async (delay: number) => {
        options.onWait?.(delay);
        options.signal?.throwIfAborted();
        if (options.wait) await options.wait(delay);
        else await abortableDelay(delay, options.signal);
    };
    for (;;) {
        options.signal?.throwIfAborted();
        let result: T;
        try {
            result = await request();
        } catch (error) {
            options.signal?.throwIfAborted();
            if (error instanceof Error && error.name === "AbortError") throw error;
            if (networkErrors >= (options.networkRetries ?? 0)) throw error;
            networkErrors += 1;
            await wait((options.delayMs ?? 800) * networkErrors);
            continue;
        }
        if (result.response.status !== 429) return result;
        if (rateLimits >= (options.retries ?? JIMAKU_429_MAX_RETRIES)) {
            throw new Error(options.exhaustedMessage);
        }
        rateLimits += 1;
        await wait(retryAfterToMs(result.response.headers.get("Retry-After") ?? result.data?.retryAfter));
    }
}
