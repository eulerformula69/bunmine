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
function createAnkiMediaController(options) {
    const inputValue = (id) => document.getElementById(id)?.value || "";
    function buildSnapshot({ subtitleIndex = null } = {}) {
        const videoPayload = options.getVideoPayload();
        if (!videoPayload)
            throw new Error(options.translate("toastVideoNotUploaded"));
        const offsetStart = parseFloat(inputValue("subOffsetStart")) || 0;
        const offsetEnd = parseFloat(inputValue("subOffsetEnd")) || 0;
        const ankiUrl = inputValue("ankiUrl");
        const deckName = inputValue("deckName");
        const screenshotMode = inputValue("screenshotMode");
        const sentenceField = inputValue("sentenceField").trim();
        const pictureField = inputValue("pictureField").trim();
        const audioField = inputValue("audioField").trim();
        const sentenceFuriganaField = inputValue("sentenceFuriganaField").trim();
        if (!pictureField || !audioField) {
            throw new Error(options.translate("toastRequiredFields"));
        }
        if (!ankiUrl || !deckName) {
            throw new Error(options.translate("toastAnkiSettingsRequired"));
        }
        const currentIdx = Number.isInteger(subtitleIndex)
            ? Number(subtitleIndex)
            : options.getActiveSubtitleIndex();
        if (currentIdx === -1)
            throw new Error(options.translate("toastNoActiveSubtitle"));
        const targetTime = screenshotMode === "current"
            ? options.getVideoCurrentTime()
            : Math.max(0, options.getSubtitleStart(currentIdx) + offsetStart);
        const context = options.getSubtitleContext(currentIdx);
        const globalDelay = options.getGlobalSubtitleDelay();
        const audioStart = Math.max(0, context.startTime + globalDelay + offsetStart);
        let audioEnd = context.endTime + globalDelay + offsetEnd;
        if (audioEnd <= audioStart)
            audioEnd = audioStart + 0.5;
        const includeImageSubtitle = document.getElementById("includeImageSubtitle")?.checked !== false;
        return {
            videoPayload,
            volumeLevel: options.getValidatedVolume(),
            ankiUrl,
            deckName,
            screenshotMode,
            sentenceField,
            pictureField,
            audioField,
            sentenceFuriganaField,
            currentIdx,
            targetTime,
            audioStart,
            audioEnd,
            combinedText: context.text,
            imageSubtitleText: includeImageSubtitle ? context.text : "",
            fontSize: inputValue("fontSizeRange"),
            trackIndex: "a:0"
        };
    }
    async function updateNote(targetNoteId, snapshot) {
        const pictureEndpoint = snapshot.screenshotMode === "webp"
            ? "/animated-webp"
            : "/screenshot";
        const picturePayload = snapshot.screenshotMode === "webp"
            ? {
                ...snapshot.videoPayload,
                start: snapshot.audioStart,
                end: snapshot.audioEnd,
                text: snapshot.imageSubtitleText,
                fontSize: snapshot.fontSize
            }
            : {
                ...snapshot.videoPayload,
                time: snapshot.targetTime,
                text: snapshot.imageSubtitleText,
                fontSize: snapshot.fontSize
            };
        const [pictureResponse, audioResponse] = await Promise.all([
            fetch(buildApiUrl(pictureEndpoint), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(picturePayload)
            }),
            fetch(buildApiUrl("/audio-to-anki"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...snapshot.videoPayload,
                    start: snapshot.audioStart,
                    end: snapshot.audioEnd,
                    trackIndex: snapshot.trackIndex,
                    volume: snapshot.volumeLevel
                })
            })
        ]);
        const pictureData = await pictureResponse.json();
        const audioData = await audioResponse.json();
        if (!pictureResponse.ok || !audioResponse.ok) {
            throw new Error(pictureData.error || audioData.error || "Media server error");
        }
        const [targetNoteInfo] = await fetchNotesInfo(snapshot.ankiUrl, [targetNoteId]);
        const targetWord = getNoteWord(targetNoteInfo);
        const sentence = targetWord
            ? boldWordInText(snapshot.combinedText, targetWord)
            : snapshot.combinedText;
        let furiganaSentence = "";
        if (snapshot.sentenceFuriganaField) {
            try {
                furiganaSentence = boldWordInText(await Promise.race([
                    buildSentenceFurigana(snapshot.combinedText),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Furigana generation timeout")), 1500))
                ]), targetWord);
            }
            catch (error) {
                console.warn("Furigana generation skipped:", error);
            }
        }
        const fields = {
            [snapshot.pictureField]: `<img src="${pictureData.filename}">`,
            [snapshot.audioField]: `[sound:${audioData.filename}]`
        };
        if (snapshot.sentenceField)
            fields[snapshot.sentenceField] = sentence;
        if (snapshot.sentenceFuriganaField) {
            fields[snapshot.sentenceFuriganaField] = furiganaSentence;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let updateResponse;
        try {
            updateResponse = await fetch(snapshot.ankiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    action: "updateNoteFields",
                    version: 6,
                    params: { note: { id: targetNoteId, fields } }
                })
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
        const updateData = await updateResponse.json();
        if (!updateResponse.ok || updateData.error) {
            throw new Error(updateData.error || `Anki update failed: HTTP ${updateResponse.status}`);
        }
        options.resetRuntimeHighlightPrefetch();
        try {
            await options.refreshKnownWord({
                noteId: targetNoteId,
                word: targetWord,
                wordFields: options.getHighlightWordFields()
            });
        }
        catch (error) {
            console.warn("Could not refresh known-anki-words.json for updated card:", error);
        }
        options.ensureSubtitleStatuses(snapshot.combinedText)
            .then(options.prefetchSubtitleStatuses)
            .catch((error) => console.warn("Could not update runtime highlight status:", error));
        return { targetWord };
    }
    async function updateCurrentOrSelected() {
        const snapshot = buildSnapshot();
        const noteIds = await fetchDeckNoteIds(snapshot.ankiUrl, snapshot.deckName);
        if (!noteIds.length) {
            throw new Error(`Error: There are no cards in "${snapshot.deckName}"!`);
        }
        const selectedId = options.getTargetNoteId();
        const targetNoteId = selectedId > 0 ? selectedId : noteIds[noteIds.length - 1];
        await updateNote(targetNoteId, snapshot);
        options.showToast(options.translate("toastCardUpdated"), "success");
        options.clearTargetNote();
        options.refreshTargetNotes();
        options.maybePromptSubtitleDepthReset();
    }
    return { buildSnapshot, updateNote, updateCurrentOrSelected };
}
