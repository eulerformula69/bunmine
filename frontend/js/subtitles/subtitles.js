// overlay rendering
function clearSubtitleOverlay(overlayEl) {
    if (!overlayEl)
        return;
    overlayEl.textContent = "";
}
function updateSubtitleComprehensionBadge(level) {
    const badge = document.getElementById("comprehensionLevelBadge");
    if (!badge)
        return;
    if (!level) {
        badge.textContent = "";
        badge.classList.add("hidden");
        return;
    }
    badge.textContent = level;
    badge.classList.remove("hidden");
}
function getSubtitleStatusSettings(highlighter, status) {
    if (!highlighter || !highlighter.statusSettings)
        return null;
    return highlighter.statusSettings[status] || null;
}
function appendPlainSubtitleText(overlayEl, text) {
    overlayEl.textContent = text || "";
}
function appendHighlightedToken(overlayEl, token, status, settings) {
    const span = document.createElement("span");
    span.className = `subtitle-word subtitle-word-${status || "unknown"}`;
    span.textContent = token;
    if (settings?.color) {
        span.style.color = settings.color;
    }
    overlayEl.appendChild(span);
}
function tokenizeSubtitleForHighlighting(text) {
    return String(text || "").match(/(\s+|[^\s]+)/g) || [];
}
function renderHighlightedSubtitleOverlay(overlayEl, text, highlighter) {
    if (typeof highlighter.findMatchesInText === "function") {
        renderMatchedSubtitleOverlay(overlayEl, text, highlighter);
        return;
    }
    const tokens = tokenizeSubtitleForHighlighting(text);
    for (const token of tokens) {
        const isWhitespace = /^\s+$/.test(token);
        if (isWhitespace) {
            overlayEl.appendChild(document.createTextNode(token));
            continue;
        }
        const status = highlighter.getStatusForTextToken?.(token) || "unknown";
        const settings = getSubtitleStatusSettings(highlighter, status);
        if (!settings || settings.enabled === false) {
            overlayEl.appendChild(document.createTextNode(token));
            continue;
        }
        appendHighlightedToken(overlayEl, token, status, settings);
    }
}
function renderMatchedSubtitleOverlay(overlayEl, text, highlighter) {
    const matches = highlighter.findMatchesInText(text) || [];
    if (!matches.length) {
        appendPlainSubtitleText(overlayEl, text);
        return;
    }
    let cursor = 0;
    for (const match of matches) {
        if (match.start < cursor)
            continue;
        if (match.start > cursor) {
            overlayEl.appendChild(document.createTextNode(text.slice(cursor, match.start)));
        }
        const matchedText = text.slice(match.start, match.end);
        const settings = getSubtitleStatusSettings(highlighter, match.status);
        if (!settings || settings.enabled === false) {
            overlayEl.appendChild(document.createTextNode(matchedText));
        }
        else {
            appendHighlightedToken(overlayEl, matchedText, match.status, settings);
        }
        cursor = match.end;
    }
    if (cursor < text.length) {
        overlayEl.appendChild(document.createTextNode(text.slice(cursor)));
    }
}
function renderSubtitleOverlay(options) {
    const overlay = options.overlay;
    const text = options.text;
    const highlighter = options.highlighter || null;
    if (!overlay)
        return;
    clearSubtitleOverlay(overlay);
    updateSubtitleComprehensionBadge(null);
    if (!text)
        return;
    const comprehensionLevel = typeof getSubtitleComprehensionLevel === "function"
        ? getSubtitleComprehensionLevel(text, highlighter)
        : null;
    updateSubtitleComprehensionBadge(comprehensionLevel);
    if (comprehensionLevel &&
        typeof shouldShowSubtitleForComprehensionLevel === "function" &&
        !shouldShowSubtitleForComprehensionLevel(comprehensionLevel)) {
        return;
    }
    if (!highlighter || highlighter.enabled !== true) {
        appendPlainSubtitleText(overlay, text);
        return;
    }
    renderHighlightedSubtitleOverlay(overlay, text, highlighter);
}
