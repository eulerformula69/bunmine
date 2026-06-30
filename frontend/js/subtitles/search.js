function katakanaToHiraganaSearchText(text) {
    return String(text || "").replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
const subtitleKanaRomajiMap = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "ん": "n", "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po"
};
function kanaToRomajiSearchText(text) {
    const hira = katakanaToHiraganaSearchText(text);
    let out = "";
    for (let i = 0; i < hira.length; i += 1) {
        const pair = hira.slice(i, i + 2);
        if (hira[i] === "っ") {
            const next = subtitleKanaRomajiMap[hira.slice(i + 1, i + 3)] || subtitleKanaRomajiMap[hira[i + 1]] || "";
            out += next[0] || "";
            continue;
        }
        if (subtitleKanaRomajiMap[pair]) {
            out += subtitleKanaRomajiMap[pair];
            i += 1;
            continue;
        }
        out += subtitleKanaRomajiMap[hira[i]] || hira[i];
    }
    return out;
}
function normalizeSubtitleSearchText(value) {
    return kanaToRomajiSearchText(katakanaToHiraganaSearchText(String(value || "").toLowerCase()));
}
function getSubtitleTokenSurface(token) {
    return String(token.surface_form || token.surface || token.word || "");
}
function getSubtitleTokenReading(token) {
    return String(token.reading || token.pronunciation || "");
}
function findSubtitleTextMatchesInCues(cues, query, tokenize) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery)
        return [];
    const qRaw = cleanQuery.toLowerCase();
    const qKanaRomaji = normalizeSubtitleSearchText(cleanQuery);
    const matches = [];
    cues.forEach((sub, subtitleIndex) => {
        const text = String(sub.text || "");
        const tokens = tokenize(text) || [];
        let cursor = 0;
        tokens.forEach((token) => {
            const surface = getSubtitleTokenSurface(token);
            if (!surface)
                return;
            const start = text.indexOf(surface, cursor);
            if (start === -1)
                return;
            const end = start + surface.length;
            cursor = end;
            const surfaceLower = surface.toLowerCase();
            const reading = getSubtitleTokenReading(token);
            const readingHira = katakanaToHiraganaSearchText(reading);
            const readingRomaji = kanaToRomajiSearchText(readingHira);
            const tokenSearchForms = [
                surfaceLower,
                readingHira.toLowerCase(),
                readingRomaji.toLowerCase()
            ];
            if (tokenSearchForms.some((form) => form.includes(qRaw) || form.includes(qKanaRomaji))) {
                matches.push({
                    type: "word",
                    subtitleIndex,
                    start,
                    end,
                    query: cleanQuery
                });
            }
        });
    });
    return matches;
}
function getSubtitleSearchHaystackForText(text, tokenize) {
    const raw = String(text || "").toLowerCase();
    const tokens = tokenize(raw) || [];
    const readings = tokens
        .map((token) => token.reading || token.pronunciation || "")
        .filter(Boolean)
        .join("");
    const kana = katakanaToHiraganaSearchText(String(readings));
    const romaji = kanaToRomajiSearchText(kana);
    return `${raw} ${kana} ${romaji}`.toLowerCase();
}
function parseSubtitleSearchTime(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return null;
    if (/^\d+(\.\d+)?$/.test(raw)) {
        return Number(raw);
    }
    const parts = raw.split(":").map(Number);
    if (parts.some((part) => Number.isNaN(part)))
        return null;
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
}
function findSubtitleIndexByTime(cues, seconds, delaySeconds) {
    if (!Number.isFinite(seconds))
        return -1;
    const exactIndex = cues.findIndex((sub) => {
        return seconds >= sub.start + delaySeconds && seconds <= sub.end + delaySeconds;
    });
    if (exactIndex !== -1)
        return exactIndex;
    let bestIndex = -1;
    let bestDistance = Infinity;
    cues.forEach((sub, index) => {
        const distance = Math.abs((sub.start + delaySeconds) - seconds);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });
    return bestIndex;
}
function buildSubtitleTimeSearchMatches(cues, seconds, delaySeconds) {
    const subtitleIndex = findSubtitleIndexByTime(cues, seconds, delaySeconds);
    if (subtitleIndex < 0)
        return [];
    return [{
            type: "time",
            subtitleIndex,
            start: 0,
            end: 0,
            query: "",
            seconds
        }];
}
