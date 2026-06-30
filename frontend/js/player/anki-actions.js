function hasRequiredAnkiMediaFields(fields) {
    return Boolean(fields.pictureField?.trim() && fields.audioField?.trim());
}
function normalizeSelectedAnkiWord(word) {
    return String(word || "").trim();
}
async function fetchDeckNoteIds(ankiUrl, deckName) {
    const findRes = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "findNotes",
            version: 6,
            params: {
                query: `deck:"${deckName}"`
            }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label: "AnkiConnect findNotes"
    });
    const findData = await findRes.json();
    if (findData.error)
        throw new Error(findData.error);
    return Array.isArray(findData.result) ? findData.result : [];
}
async function fetchNoteIdsByQuery(ankiUrl, query, label = "AnkiConnect findNotes") {
    const findRes = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "findNotes",
            version: 6,
            params: { query }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label
    });
    const findData = await findRes.json();
    if (findData.error)
        throw new Error(findData.error);
    return Array.isArray(findData.result) ? findData.result : [];
}
async function fetchNotesInfo(ankiUrl, noteIds) {
    const res = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "notesInfo",
            version: 6,
            params: {
                notes: noteIds
            }
        })
    }, {
        retries: 3,
        delayMs: 1000,
        label: "AnkiConnect notesInfo"
    });
    const data = await res.json();
    if (data.error)
        throw new Error(data.error);
    return Array.isArray(data.result) ? data.result : [];
}
function stripHtml(input) {
    return String(input || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function isKanaOnly(text) {
    return /^[\u3040-\u309f\u30a0-\u30ffー]+$/.test(String(text || ""));
}
function hasKanji(text) {
    return /[\u3400-\u9fff]/.test(String(text || ""));
}
function escapeAnkiFieldText(text) {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}
function splitKanjiStemAndKanaTail(surface, readingHiragana) {
    const match = String(surface || "").match(/^(.+?)([\u3040-\u309f]+)$/);
    if (!match) {
        return {
            stem: surface,
            tail: "",
            stemReading: readingHiragana
        };
    }
    const stem = match[1];
    const tail = match[2];
    if (!hasKanji(stem)) {
        return {
            stem: surface,
            tail: "",
            stemReading: readingHiragana
        };
    }
    if (readingHiragana.endsWith(tail)) {
        return {
            stem,
            tail,
            stemReading: readingHiragana.slice(0, -tail.length)
        };
    }
    return {
        stem: surface,
        tail: "",
        stemReading: readingHiragana
    };
}
function escapeRegExp(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function boldWordInText(text, word) {
    const source = String(text || "");
    const target = stripHtml(word);
    if (!target)
        return source;
    const pattern = new RegExp(`${escapeRegExp(target)}(\\[[^\\]]+\\])?`, "g");
    return source.replace(pattern, (match) => `<b>${match}</b>`);
}
function getNoteWord(noteInfo) {
    const fields = noteInfo?.fields || {};
    const wordFieldNames = (document.getElementById("highlightWordField")?.value || "Word")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    for (const fieldName of wordFieldNames) {
        const word = stripHtml(fields[fieldName]?.value);
        if (word)
            return word;
    }
    return "";
}
async function buildSentenceFurigana(text) {
    const source = String(text || "");
    if (!source)
        return "";
    if (typeof tokenizeJapaneseText !== "function") {
        console.warn("tokenizeJapaneseText is not available");
        return source;
    }
    const tokens = await tokenizeJapaneseText(source);
    let result = "";
    let lastEnd = 0;
    for (const token of tokens) {
        const surface = token.surface_form || "";
        const reading = token.reading || "";
        if (!surface)
            continue;
        const start = Math.max(0, Number(token.word_position || 1) - 1);
        const end = start + surface.length;
        if (start > lastEnd) {
            result += source.slice(lastEnd, start);
        }
        const previousChar = result.slice(-1);
        const shouldAddSpaceBeforeKanjiWord = hasKanji(surface) &&
            result &&
            previousChar &&
            !/\s/.test(previousChar) &&
            !/[（(「『【［]/.test(previousChar);
        if (shouldAddSpaceBeforeKanjiWord) {
            result += " ";
        }
        if (!hasKanji(surface) || !reading) {
            result += surface;
            lastEnd = end;
            continue;
        }
        const hiraganaReading = katakanaToHiragana(reading);
        const { stem, tail, stemReading } = splitKanjiStemAndKanaTail(surface, hiraganaReading);
        if (!stemReading) {
            result += surface;
            lastEnd = end;
            continue;
        }
        result += `${stem}[${stemReading}]${tail}`;
        lastEnd = end;
    }
    if (lastEnd < source.length) {
        result += source.slice(lastEnd);
    }
    return result;
}
function katakanaToHiragana(text) {
    return String(text || "").replace(/[\u30a1-\u30f6]/g, (char) => {
        return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
}
function pickNotePreviewText(noteInfo) {
    const fields = noteInfo?.fields || {};
    const preferredFieldOrder = [
        "Word", "Key", "Expression", "Sentence", "Front", "Back", "Meaning", "Definition"
    ];
    for (const key of preferredFieldOrder) {
        const value = stripHtml(fields[key]?.value);
        if (value)
            return value;
    }
    for (const field of Object.values(fields)) {
        const value = stripHtml(field?.value);
        if (value)
            return value;
    }
    return "";
}
// TODO: Move AnkiConnect polling/update flows after auto-attach queue state is separated from player/app.js.
