// parsing

function parseSubtitleTimestamp(value) {
    const match = String(value).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/);
    if (!match) return null;
    const hours = Number(match[1] || 0);
    return hours * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, "0")) / 1000;
}

function cleanSubtitleText(lines) {
    return lines
        .map((line) => line.trim())
        .join("\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\{\\.*?\}/g, "")
        .trim();
}

function parseSRT(data) {
    const blocks = String(data).replace(/^\uFEFF/, "").replace(/\r/g, "").trim().split(/\n{2,}/);
    const subs = [];

    for (const block of blocks) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex < 0) continue;
        const [startValue, endValue] = lines[timingIndex].split("-->");
        const start = parseSubtitleTimestamp(startValue);
        const end = parseSubtitleTimestamp(endValue);
        const text = cleanSubtitleText(lines.slice(timingIndex + 1));
        if (start !== null && end !== null && end > start && text) subs.push({ start, end, text });
    }

    return subs.sort((left, right) => left.start - right.start || left.end - right.end);
}

function parseASS(data) {
    const lines = data.split("\n");
    const subs = [];

    const timeToSeconds = (timeStr) => {
        const parts = timeStr.trim().split(":");
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    };

    lines.forEach((line) => {
        if (!line.startsWith("Dialogue:")) return;

        const parts = line.split(",");
        if (parts.length < 10) return;

        const layer = Number(parts[0].slice("Dialogue:".length).trim()) || 0;
        const start = timeToSeconds(parts[1]);
        const end = timeToSeconds(parts[2]);
        const style = parts[3].trim();
        const text = parts.slice(9).join(",")
            .replace(/\{.*?\}/g, "")
            .replace(/\\N/g, "\n")
            .replace(/\\n/g, " ")
            .replace(/\\h/g, " ")
            .trim();

        if (text && end > start) subs.push({ start, end, text, layer, style });
    });

    return subs.sort((left, right) => left.start - right.start || left.layer - right.layer);
}

function formatTime(t) {
    if (!Number.isFinite(t) || t < 0) t = 0;

    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const milliseconds = Math.floor((t % 1) * 1000);

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}
