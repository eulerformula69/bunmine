const API_BASE = window.location.origin;

function buildApiUrl(path) {
    return `${API_BASE}${path}`;
}

async function apiJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), options);
    const data = await response.json();
    return { response, data };
}
