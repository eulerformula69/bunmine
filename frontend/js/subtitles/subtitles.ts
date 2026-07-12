// overlay rendering

function clearSubtitleOverlay(overlayEl) {
    if (!overlayEl) return;
    overlayEl.textContent = "";
}

function updateSubtitleComprehensionBadge(level) {
    const badge = document.getElementById("comprehensionLevelBadge");

    if (!badge) return;

    if (!level) {
        badge.textContent = "";
        badge.classList.add("hidden");
        return;
    }

    badge.textContent = level;
    badge.classList.remove("hidden");
}

function getSubtitleStatusSettings(highlighter, status) {
    if (!highlighter || !highlighter.statusSettings) return null;
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
        if (match.start < cursor) continue;

        if (match.start > cursor) {
            overlayEl.appendChild(
                document.createTextNode(text.slice(cursor, match.start))
            );
        }

        const matchedText = text.slice(match.start, match.end);
        const settings = getSubtitleStatusSettings(highlighter, match.status);

        if (!settings || settings.enabled === false) {
            overlayEl.appendChild(document.createTextNode(matchedText));
        } else {
            appendHighlightedToken(
                overlayEl,
                matchedText,
                match.status,
                settings
            );
        }

        cursor = match.end;
    }

    if (cursor < text.length) {
        overlayEl.appendChild(document.createTextNode(text.slice(cursor)));
    }
}

function renderSubtitleOverlay(options) {
    const overlay = options.overlay;
    const cueEntries = Array.isArray(options.cues)
        ? options.cues.map((cue, position) => ({
            cue,
            index: Number.isInteger(options.cueIndices?.[position]) ? options.cueIndices[position] : -1
        }))
        : [];
    const texts = cueEntries.length
        ? cueEntries.map(({ cue }) => cue.text)
        : (Array.isArray(options.texts) ? options.texts.filter(Boolean) : (options.text ? [options.text] : []));
    const highlighter = options.highlighter || null;

    if (!overlay) return;

    clearSubtitleOverlay(overlay);
    updateSubtitleComprehensionBadge(null);

    if (!texts.length) return;

    const regions = new Map<string, HTMLElement>();
    const primaryIndex = typeof getPrimarySubtitleIndex === "function" ? getPrimarySubtitleIndex() : -1;

    for (let position = 0; position < texts.length; position += 1) {
        const text = texts[position];
        const entry = cueEntries[position];
        const cue = entry?.cue;
        const cueIndex = entry?.index ?? -1;
        const alignment = Number(cue?.alignment || 2);
        const line = document.createElement("div");
        line.className = "subtitle-overlay-line";
        line.classList.add(`subtitle-alignment-${alignment}`);
        if (cueIndex >= 0) line.dataset.subtitleIndex = String(cueIndex);
        if (cueIndex === primaryIndex) line.classList.add("primary");
        applySubtitleCueStyle(line, cue);
        renderSubtitleOverlayLine(line, text, cueIndex === primaryIndex ? highlighter : null);

        if (cueIndex >= 0) {
            line.addEventListener("click", (event) => {
                event.stopPropagation();
                selectPrimarySubtitle(cueIndex);
                renderSubtitleOverlay({
                    overlay,
                    cues: getActiveSubtitles(),
                    cueIndices: getActiveSubtitleEntries().map(({ index }) => index),
                    highlighter
                });
            });
        }

        const regionKey = getSubtitleRegionKey(cue);
        let region = regions.get(regionKey);
        if (!region) {
            region = document.createElement("div");
            region.className = `subtitle-overlay-region subtitle-overlay-region-${regionKey}`;
            applyPositionedSubtitleRegion(region, cue);
            regions.set(regionKey, region);
            overlay.appendChild(region);
        }
        region.appendChild(line);
    }
}

function applySubtitleCueStyle(line, cue) {
    if (!cue) return;
    if (cue.fontName) line.style.fontFamily = `"${cue.fontName}", "NotoSansJP", sans-serif`;
    if (cue.fontSize) line.style.fontSize = `${Math.max(0.6, Math.min(2.5, cue.fontSize / 40))}em`;
    if (cue.primaryColor) line.style.color = cue.primaryColor;
    if (cue.bold) line.style.fontWeight = "700";
    if (cue.italic) line.style.fontStyle = "italic";
}

function getSubtitleRegionKey(cue) {
    if (cue?.positionX !== undefined && cue?.positionY !== undefined) return `positioned-${cue.positionX}-${cue.positionY}`;
    const alignment = Number(cue?.alignment || 2);
    if (alignment >= 7) return "top";
    if (alignment >= 4) return "middle";
    return "bottom";
}

function applyPositionedSubtitleRegion(region, cue) {
    if (cue?.positionX === undefined || cue?.positionY === undefined) return;
    const x = Math.max(0, Math.min(100, cue.positionX / Number(cue.playResX || 384) * 100));
    const y = Math.max(0, Math.min(100, cue.positionY / Number(cue.playResY || 288) * 100));
    region.classList.add("subtitle-overlay-region-positioned");
    region.style.left = `${x}%`;
    region.style.top = `${y}%`;
    const alignment = Number(cue.alignment || 2);
    const translateX = alignment % 3 === 1 ? "0%" : (alignment % 3 === 0 ? "-100%" : "-50%");
    const translateY = alignment >= 7 ? "0%" : (alignment >= 4 ? "-50%" : "-100%");
    region.style.transform = `translate(${translateX}, ${translateY})`;
}

function renderSubtitleOverlayLine(overlayEl, text, highlighter) {

    const comprehensionLevel = typeof getSubtitleComprehensionLevel === "function"
        ? getSubtitleComprehensionLevel(text, highlighter)
        : null;

    updateSubtitleComprehensionBadge(comprehensionLevel);

    if (
        comprehensionLevel &&
        typeof shouldShowSubtitleForComprehensionLevel === "function" &&
        !shouldShowSubtitleForComprehensionLevel(comprehensionLevel)
    ) {
        return;
    }

    if (!highlighter || highlighter.enabled !== true) {
        appendPlainSubtitleText(overlayEl, text);
        return;
    }

    renderHighlightedSubtitleOverlay(overlayEl, text, highlighter);
}
