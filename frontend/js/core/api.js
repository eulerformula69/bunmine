const API_BASE = window.location.origin;

function buildApiUrl(path) {
    return `${API_BASE}${path}`;
}

async function apiJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), options);
    const data = await response.json();
    normalizeApiPayload(data);
    return { response, data };
}

function normalizeApiPayload(data) {
    if (!data || typeof data !== "object") return data;

    if (data.ok === false && data.error && typeof data.error === "object") {
        data.errorInfo = data.error;
        data.error = data.error.message || "Request failed";
    }

    return data;
}

function getApiErrorMessage(data, fallback = "Request failed") {
    if (!data || typeof data !== "object") return fallback;
    if (typeof data.error === "string" && data.error) return data.error;
    if (data.errorInfo?.message) return data.errorInfo.message;
    return fallback;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, {
    retries = 5,
    delayMs = 800,
    label = "request"
} = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            return await fetch(url, options);
        } catch (err) {
            lastError = err;

            console.warn(
                `${label} failed ${attempt}/${retries}:`,
                err.message
            );

            if (attempt < retries) {
                await sleep(delayMs * attempt);
            }
        }
    }

    const message = lastError?.message || String(lastError || "Unknown error");
    if (String(label).toLowerCase().includes("ankiconnect")) {
        throw new Error(`${label} failed. Make sure Anki is open and AnkiConnect is installed. Details: ${message}`);
    }
    throw new Error(`${label} failed: ${message}`);
}



