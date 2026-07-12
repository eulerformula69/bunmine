// parsing
function parseSubtitleTimestamp(value) {
    const match = String(value).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/);
    if (!match)
        return null;
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
        if (timingIndex < 0)
            continue;
        const [startValue, endValue] = lines[timingIndex].split("-->");
        const start = parseSubtitleTimestamp(startValue);
        const end = parseSubtitleTimestamp(endValue);
        const text = cleanSubtitleText(lines.slice(timingIndex + 1));
        if (start !== null && end !== null && end > start && text)
            subs.push({ start, end, text });
    }
    return subs.sort((left, right) => left.start - right.start || left.end - right.end);
}
function parseASS(data) {
    const lines = String(data).replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const subs = [];
    const styles = new Map();
    let section = "";
    let styleFormat = [];
    let eventFormat = [];
    let playResX = 384;
    let playResY = 288;
    const timeToSeconds = (timeStr) => {
        const parts = timeStr.trim().split(":");
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
    };
    const assColorToCss = (value) => {
        const source = String(value || "").trim();
        if (!source)
            return "";
        const hex = source.replace(/^&H/i, "").replace(/&$/, "").padStart(8, "0");
        const blue = hex.slice(-6, -4);
        const green = hex.slice(-4, -2);
        const red = hex.slice(-2);
        return `#${red}${green}${blue}`;
    };
    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        const sectionMatch = line.match(/^\[(.+)]$/);
        if (sectionMatch) {
            section = sectionMatch[1].toLowerCase();
            return;
        }
        if (/^PlayResX:/i.test(line))
            playResX = Number(line.split(":")[1]) || playResX;
        if (/^PlayResY:/i.test(line))
            playResY = Number(line.split(":")[1]) || playResY;
        if (/^Format:/i.test(line)) {
            const format = line.slice(line.indexOf(":") + 1).split(",").map((item) => item.trim().toLowerCase());
            if (section.includes("styles"))
                styleFormat = format;
            if (section === "events")
                eventFormat = format;
            return;
        }
        if (/^Style:/i.test(line) && styleFormat.length) {
            const values = line.slice(line.indexOf(":") + 1).split(",");
            const styleValue = (name) => values[styleFormat.indexOf(name)]?.trim() || "";
            const name = styleValue("name");
            if (name) {
                styles.set(name, {
                    alignment: Number(styleValue("alignment")) || 2,
                    fontName: styleValue("fontname"),
                    fontSize: Number(styleValue("fontsize")) || 0,
                    primaryColor: assColorToCss(styleValue("primarycolour")),
                    bold: Number(styleValue("bold")) !== 0,
                    italic: Number(styleValue("italic")) !== 0
                });
            }
            return;
        }
        if (!/^Dialogue:/i.test(line))
            return;
        const values = line.slice(line.indexOf(":") + 1).split(",");
        const format = eventFormat.length
            ? eventFormat
            : ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
        const textIndex = Math.max(0, format.indexOf("text"));
        if (values.length <= textIndex)
            return;
        const value = (name) => values[format.indexOf(name)]?.trim() || "";
        const rawText = values.slice(textIndex).join(",");
        const overrideAlignment = rawText.match(/\\an([1-9])/i);
        const position = rawText.match(/\\pos\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i);
        const layer = Number(value("layer")) || 0;
        const start = timeToSeconds(value("start"));
        const end = timeToSeconds(value("end"));
        const style = value("style");
        const styleDefinition = styles.get(style) || {};
        const alignment = Number(overrideAlignment?.[1]) || Number(styleDefinition.alignment) || 2;
        const text = rawText
            .replace(/\{.*?\}/g, "")
            .replace(/\\N/g, "\n")
            .replace(/\\n/g, " ")
            .replace(/\\h/g, " ")
            .trim();
        if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
            subs.push({
                start,
                end,
                text,
                layer,
                style,
                alignment,
                positionX: position ? Number(position[1]) : undefined,
                positionY: position ? Number(position[2]) : undefined,
                playResX,
                playResY,
                fontName: String(styleDefinition.fontName || ""),
                fontSize: Number(styleDefinition.fontSize) || undefined,
                primaryColor: String(styleDefinition.primaryColor || ""),
                bold: Boolean(styleDefinition.bold),
                italic: Boolean(styleDefinition.italic)
            });
        }
    });
    return subs.sort((left, right) => left.start - right.start || left.layer - right.layer);
}
function formatTime(t) {
    if (!Number.isFinite(t) || t < 0)
        t = 0;
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const milliseconds = Math.floor((t % 1) * 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}
