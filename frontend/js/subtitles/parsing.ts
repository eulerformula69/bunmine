// parsing

function parseSRT(data) {
    data = data.replace(/\r/g, "").trim();
    const blocks = data.split("\n\n");
    const subs = [];

    for (const block of blocks) {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length < 3) continue;

        const match = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s-->\s(\d+):(\d+):(\d+),(\d+)/);
        if (!match) continue;

        const start = +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
        const end = +match[5] * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000;
		const rawText = lines.slice(2).map((l) => l.trim()).join(" ");

		// РџСЂРѕРїСѓСЃРєР°РµРј РІРµСЂС…РЅРёРµ СЃСѓР±С‚РёС‚СЂС‹ С‚РёРїР° {\an8}
		if (/\{\\an8\}/.test(rawText)) continue;

		// РќР° РІСЃСЏРєРёР№ СЃР»СѓС‡Р°Р№ С‡РёСЃС‚РёРј РѕСЃС‚Р°Р»СЊРЅС‹Рµ ASS/SRT override-С‚РµРіРё
		const text = rawText
			.replace(/\{\\.*?\}/g, "")
			.trim();

		if (text) {
			subs.push({ start, end, text });
		}
    }

    return subs;
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

        const start = timeToSeconds(parts[1]);
        const end = timeToSeconds(parts[2]);
        const text = parts.slice(9).join(",")
            .replace(/\{.*?\}/g, "")
            .replace(/\\N/g, "\n")
            .replace(/\\n/g, " ")
            .replace(/\\h/g, " ")
            .trim();

        if (text) subs.push({ start, end, text });
    });

    return subs;
}

function formatTime(t) {
    if (!Number.isFinite(t) || t < 0) t = 0;

    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const milliseconds = Math.floor((t % 1) * 1000);

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}
