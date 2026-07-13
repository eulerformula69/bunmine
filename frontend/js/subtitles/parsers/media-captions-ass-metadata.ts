interface MediaCaptionsAssCueMetadata {
    startTime: number;
    endTime: number;
    rawText: string;
    layer?: number;
    style?: string;
    alignment?: number;
    positionX?: number;
    positionY?: number;
    playResX?: number;
    playResY?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    bold?: boolean;
    italic?: boolean;
}

interface MediaCaptionsAssStyle {
    alignment?: number;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    bold?: boolean;
    italic?: boolean;
}

function extractMediaCaptionsAssMetadata(
    source: string,
    format: "ass" | "ssa"
): MediaCaptionsAssCueMetadata[] {
    const lines = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const styles = new Map<string, MediaCaptionsAssStyle>();
    const cues: MediaCaptionsAssCueMetadata[] = [];
    let section = "";
    let styleFormat: string[] = [];
    let eventFormat: string[] = [];
    let playResX: number | undefined;
    let playResY: number | undefined;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const sectionMatch = line.match(/^\[(.+)]$/);
        if (sectionMatch) {
            section = sectionMatch[1].toLowerCase();
            continue;
        }
        if (/^PlayResX:/i.test(line)) playResX = parseFiniteAssNumber(line.split(":")[1]);
        if (/^PlayResY:/i.test(line)) playResY = parseFiniteAssNumber(line.split(":")[1]);
        if (/^Format:/i.test(line)) {
            const fields = line.slice(line.indexOf(":") + 1).split(",").map((field) => field.trim().toLowerCase());
            if (section.includes("styles")) styleFormat = fields;
            if (section === "events") eventFormat = fields;
            continue;
        }
        if (/^Style:/i.test(line) && styleFormat.length) {
            const values = line.slice(line.indexOf(":") + 1).split(",");
            const value = (name: string): string => values[styleFormat.indexOf(name)]?.trim() || "";
            const name = value("name");
            if (name) {
                styles.set(name, {
                    alignment: parseFiniteAssNumber(value("alignment")),
                    fontName: value("fontname") || undefined,
                    fontSize: parseFiniteAssNumber(value("fontsize")),
                    primaryColor: convertAssColorToCss(value("primarycolour")),
                    bold: value("bold") ? Number(value("bold")) !== 0 : undefined,
                    italic: value("italic") ? Number(value("italic")) !== 0 : undefined
                });
            }
            continue;
        }
        if (!/^Dialogue:/i.test(line)) continue;

        const values = line.slice(line.indexOf(":") + 1).split(",");
        const fields = eventFormat.length ? eventFormat : defaultAssEventFormat(format);
        const textIndex = fields.indexOf("text");
        if (textIndex < 0 || values.length <= textIndex) continue;
        const value = (name: string): string => values[fields.indexOf(name)]?.trim() || "";
        const startTime = parseAssTimestamp(value("start"));
        const endTime = parseAssTimestamp(value("end"));
        if (startTime === null || endTime === null || endTime <= startTime) continue;

        const rawText = values.slice(textIndex).join(",");
        const styleName = value("style");
        const style = styles.get(styleName) || {};
        const overrideAlignment = rawText.match(/\\an([1-9])/i);
        const position = rawText.match(/\\pos\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
        const layerValue = value("layer") || value("marked").replace(/^Marked=/i, "");

        cues.push({
            startTime,
            endTime,
            rawText,
            layer: parseFiniteAssNumber(layerValue),
            style: styleName || undefined,
            alignment: parseFiniteAssNumber(overrideAlignment?.[1]) ?? style.alignment,
            positionX: parseFiniteAssNumber(position?.[1]),
            positionY: parseFiniteAssNumber(position?.[2]),
            playResX,
            playResY,
            fontName: style.fontName,
            fontSize: style.fontSize,
            primaryColor: style.primaryColor,
            bold: style.bold,
            italic: style.italic
        });
    }

    return cues;
}

function matchMediaCaptionsAssMetadata(
    cues: readonly MediaCaptionsAssCueMetadata[],
    startTime: number,
    endTime: number,
    usedIndexes: Set<number>
): MediaCaptionsAssCueMetadata | undefined {
    const index = cues.findIndex((cue, cueIndex) => (
        !usedIndexes.has(cueIndex)
        && Math.abs(cue.startTime - startTime) < 0.001
        && Math.abs(cue.endTime - endTime) < 0.001
    ));
    if (index < 0) return undefined;
    usedIndexes.add(index);
    return cues[index];
}

function defaultAssEventFormat(format: "ass" | "ssa"): string[] {
    return format === "ssa"
        ? ["marked", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"]
        : ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
}

function parseAssTimestamp(value: string): number | null {
    const parts = value.trim().split(":");
    if (parts.length !== 3) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    const result = hours * 3600 + minutes * 60 + seconds;
    return Number.isFinite(result) ? result : null;
}

function parseFiniteAssNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function convertAssColorToCss(value: string): string | undefined {
    const source = value.trim();
    if (!source) return undefined;
    const hex = source.replace(/^&H/i, "").replace(/&$/, "").padStart(8, "0");
    if (!/^[\dA-F]{8}$/i.test(hex)) return undefined;
    return `#${hex.slice(-2)}${hex.slice(-4, -2)}${hex.slice(-6, -4)}`;
}
