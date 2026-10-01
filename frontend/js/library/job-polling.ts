import { getApiErrorMessage } from "../core/api.js";
import { abortableDelay } from "../core/async-work.js";
import { libraryGetJobStatus } from "./library-api.js";
import { LibraryJobData } from "./library-types.js";

export async function pollLibraryJob(jobId: string, options: {
    failureMessage: string;
    interval?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
}, dependencies = {request: libraryGetJobStatus, wait: abortableDelay, now: Date.now}) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 600000;
    const deadline = dependencies.now() + timeoutMs;
    const timeout = new Error("Operation timed out");
    const timer = setTimeout(() => controller.abort(timeout), timeoutMs);
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, {once: true});
    if (options.signal?.aborted) abort();
    try {
        while (dependencies.now() < deadline) {
            controller.signal.throwIfAborted();
            const {response, data} = await dependencies.request(jobId, controller.signal);
            if (!response.ok || data.error) throw new Error(getApiErrorMessage(data, options.failureMessage));
            const job = data.job as LibraryJobData["job"];
            if (job?.status === "completed") return job.result;
            if (job?.status === "failed") throw new Error(job.error || job.result?.error || options.failureMessage);
            await dependencies.wait(options.interval ?? 700, controller.signal);
        }
        throw timeout;
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
    }
}
