const API_BASE = window.location.origin;

function buildApiUrl(path: string): string {
    return `${API_BASE}${path}`;
}

async function apiJson<T extends ApiPayload = ApiPayload>(
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

function normalizeApiPayload<T extends ApiPayload>(data: T): T {
    if (!data || typeof data !== "object") return data;

    if (data.ok === false && data.error && typeof data.error === "object") {
        data.errorInfo = data.error;
        data.error = data.error.message || "Request failed";
    }

    return data;
}

function getApiErrorMessage(data: ApiPayload | null | undefined, fallback = "Request failed"): string {
    if (!data || typeof data !== "object") return fallback;
    if (typeof data.error === "string" && data.error) return data.error;
    if (data.errorInfo?.message) return data.errorInfo.message;
    return fallback;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit | undefined, {
    retries = 5,
    delayMs = 800,
    label = "request"
}: {
    retries?: number;
    delayMs?: number;
    label?: string;
} = {}): Promise<Response> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            return await fetch(url, options);
        } catch (err) {
            lastError = err;

            console.warn(
                `${label} failed ${attempt}/${retries}:`,
                err instanceof Error ? err.message : String(err)
            );

            if (attempt < retries) {
                await sleep(delayMs * attempt);
            }
        }
    }

    const message = lastError instanceof Error
        ? lastError.message
        : String(lastError || "Unknown error");
    if (String(label).toLowerCase().includes("ankiconnect")) {
        throw new Error(`${label} failed. Make sure Anki is open and AnkiConnect is installed. Details: ${message}`);
    }
    throw new Error(`${label} failed: ${message}`);
}
