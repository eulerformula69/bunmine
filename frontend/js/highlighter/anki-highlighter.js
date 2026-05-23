const ankiRuntimeWordStatusMap = new Map();

let knownBasicWordsLoaded = false;
let knownAnkiWordsLoaded = false;

function clearRuntimeWordStatuses() {
    ankiRuntimeWordStatusMap.clear();
    knownBasicWordsLoaded = false;
    knownAnkiWordsLoaded = false;
}

function getCardStatus(card) {
    if (card.queue === -1) return "suspended";
    if (card.type === 0) return "new";
    if (card.type === 1 || card.queue === 1 || card.queue === 3) return "learning";

    const interval = Number(card.interval ?? card.ivl ?? 0);
    if (interval >= 21) return "mature";

    return "young";
}

function pickBetterStatus(oldStatus, newStatus) {
    const priority = {
        mature: 5,
        young: 4,
        learning: 3,
        new: 2,
        suspended: 1,
        unknown: 0
    };

    if (!oldStatus) return newStatus;
    return priority[newStatus] > priority[oldStatus] ? newStatus : oldStatus;
}

async function ankiRequest(ankiUrl, action, params = {}) {
    const res = await fetchWithRetry(ankiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action,
            version: 6,
            params
        })
    }, {
        retries: 500,
        delayMs: 1000,
        label: `AnkiConnect ${action}`
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return data.result;
}

function normalizeHighlightWord(value) {
    return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getHighlightWordFieldNames() {
    const raw = document.getElementById("highlightWordField")?.value || "Word";

    return raw
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
}

function getHighlightDeckNames() {
    const raw = document.getElementById("highlightDeckNames")?.value
        || document.getElementById("deckName")?.value
        || "";

    return raw
        .split(",")
        .map((deck) => deck.trim())
        .filter(Boolean);
}

function escapeAnkiSearchValue(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}

function buildCurrentDeckQuery() {
    const deckNames = getHighlightDeckNames();

    return deckNames
        .map((deck) => `deck:"${escapeAnkiSearchValue(deck)}"`)
        .join(" OR ");
}

async function loadKnownBasicWords({ force = false } = {}) {
    if (knownBasicWordsLoaded && !force) return;

    try {
        const { response, data } = await apiJson("/known-basic-words");

        if (!response.ok || data.error) {
            throw new Error(data.error || "Known basic words load failed");
        }

        const words = Array.isArray(data.words) ? data.words : [];

        for (const rawWord of words) {
            const word = normalizeHighlightWord(rawWord);
            if (!word) continue;

            const prev = ankiRuntimeWordStatusMap.get(word);

            ankiRuntimeWordStatusMap.set(word, {
                ...(prev || {}),
                status: pickBetterStatus(prev?.status, "mature"),
                source: "known-basic"
            });
        }

        knownBasicWordsLoaded = true;
        console.log(`Known basic words loaded: ${words.length}`);
    } catch (err) {
        console.warn("Known basic words load failed:", err);
    }
}

async function loadKnownAnkiWords({ force = false } = {}) {
    if (knownAnkiWordsLoaded && !force) return;

    try {
        const { response, data } = await apiJson("/known-anki-words");

        if (!response.ok || data.error) {
            throw new Error(data.error || "Known Anki words load failed");
        }

        const words = data?.data?.words && typeof data.data.words === "object"
            ? data.data.words
            : {};

        let loadedCount = 0;

        for (const [rawWord, rawInfo] of Object.entries(words)) {
            const word = normalizeHighlightWord(rawWord);
            if (!word) continue;

            const info = rawInfo && typeof rawInfo === "object" ? rawInfo : {};
            const status = info.status || "unknown";
            const prev = ankiRuntimeWordStatusMap.get(word);

            ankiRuntimeWordStatusMap.set(word, {
                ...(prev || {}),
                ...info,
                status: pickBetterStatus(prev?.status, status),
                source: prev?.source === "known-basic" ? "known-basic" : "known-anki"
            });

            loadedCount += 1;
        }

        knownAnkiWordsLoaded = true;
        console.log(`Known Anki words loaded: ${loadedCount}`);
    } catch (err) {
        console.warn("Known Anki words load failed:", err);
    }
}

async function loadHighlightWordIndexes({ force = false } = {}) {
    await loadKnownAnkiWords({ force });
    await loadKnownBasicWords({ force });
}

async function checkKnownAnkiWordsStaleOnPlayerOpen({ silent = true } = {}) {
    if (typeof apiJson !== "function") return null;

    try {
        const { response, data } = await apiJson("/known-anki-words/stale-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context: "player" })
        });

        if (!response.ok || data?.error) {
            throw new Error(data?.error || "Anki highlight stale-check failed");
        }

        if (!data?.skipped) {
            clearRuntimeWordStatuses();
            await loadHighlightWordIndexes({ force: true });
        }

        if (!silent) {
            console.log("Anki highlight player stale-check:", data);
        }

        return data;
    } catch (err) {
        console.warn("Anki highlight player stale-check failed:", err);
        return { ok: false, error: err?.message || String(err) };
    }
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function refreshKnownAnkiWordsFromAnki({ fullRebuild = false } = {}) {
    const ankiUrl = document.getElementById("ankiUrl")?.value?.trim();
    const autoRefresh = document.getElementById("ankiHighlightAutoRefreshInterval")?.value || "daily";
    const wordFields = getHighlightWordFieldNames();
    const deckNames = getHighlightDeckNames();

    if (!ankiUrl || !deckNames.length || !wordFields.length) {
        throw new Error("Set AnkiConnect URL, highlight decks and word fields first.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let response;
    let data;
    try {
        ({ response, data } = await apiJson("/known-anki-words/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                ankiUrl,
                decks: deckNames,
                wordFields,
                autoRefresh,
                fullRebuild
            })
        }));
    } catch (err) {
        if (err?.name === "AbortError") {
            throw new Error("Anki highlight refresh timed out after 120 seconds. Check that Anki is open and AnkiConnect is responding.");
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to refresh known-anki-words.json");
    }

    clearRuntimeWordStatuses();
    await loadHighlightWordIndexes({ force: true });

    return data;
}

async function refreshKnownAnkiWordFromNote({ noteId, word = "", wordFields = null } = {}) {
    const ankiUrl = document.getElementById("ankiUrl")?.value?.trim();
    const fields = Array.isArray(wordFields) && wordFields.length
        ? wordFields
        : getHighlightWordFieldNames();

    if (!ankiUrl) {
        throw new Error("Set AnkiConnect URL first.");
    }
    if (!noteId && !word) {
        throw new Error("noteId or word is required.");
    }

    const { response, data } = await apiJson("/known-anki-words/refresh-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ankiUrl,
            noteId,
            word,
            wordFields: fields
        })
    });

    if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to refresh Anki highlight word");
    }

    clearRuntimeWordStatuses();
    await loadHighlightWordIndexes({ force: true });
    rerenderCurrentSubtitleWithAnkiHighlighter();

    return data;
}


function normalizeJapaneseNumberText(value) {
    return String(value || "")
        .replace(/[０-９]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        );
}

function addCandidate(candidates, value) {
    const normalized = normalizeHighlightWord(normalizeJapaneseNumberText(value));

    if (normalized && normalized !== "*") {
        candidates.push(normalized);
    }
}



function getJapaneseTokenCandidates(token) {
    const surface = String(token.surface_form || "");
    const basic = String(token.basic_form || "");
    const candidates = [];

    function add(value) {
        const normalized = normalizeHighlightWord(normalizeJapaneseNumberText(value));

        if (normalized && normalized !== "*") {
            candidates.push(normalized);
        }
    }

	function addGodanPotentialCandidates(value) {
		const eToDictionary = {
			え: "う",
			け: "く",
			げ: "ぐ",
			せ: "す",
			て: "つ",
			ね: "ぬ",
			べ: "ぶ",
			め: "む",
			れ: "る"
		};

		let stem = "";

		if (value.endsWith("る")) {
			stem = value.slice(0, -1); // 支払える -> 支払え
		} else {
			stem = value;
		}

		const last = stem.slice(-1);
		const base = stem.slice(0, -1);
		const ending = eToDictionary[last];

		if (ending) {
			add(base + ending);
		}
	}

    function addGodanConditionalCandidates(value) {
        // 言えば -> 言う
        // 書けば -> 書く
        // 読めば -> 読む
        // 話せば -> 話す
        if (!value.endsWith("えば")) return;

        const stem = value.slice(0, -2);

        const eToDictionary = {
            え: "う",
            け: "く",
            げ: "ぐ",
            せ: "す",
            て: "つ",
            ね: "ぬ",
            べ: "ぶ",
            め: "む",
            れ: "る"
        };

        const last = stem.slice(-1);
        const base = stem.slice(0, -1);
        const ending = eToDictionary[last];

        if (ending) {
            add(base + ending);
        }
    }

    add(surface);
    add(basic);

    addGodanPotentialCandidates(surface);
    addGodanPotentialCandidates(basic);

    addGodanConditionalCandidates(surface);
    addGodanConditionalCandidates(basic);

    if (surface.endsWith("まない")) {
        add(surface.slice(0, -3) + "む");
    }

    if (surface.endsWith("まなかった")) {
        add(surface.slice(0, -5) + "む");
    }

    return [...new Set(candidates)];
}

function isVerbChainTailToken(token) {
    if (!token) return false;

    const surface = token.surface_form || "";
    const basic = token.basic_form || "";
    const pos = token.pos || "";
    const posDetail1 = token.pos_detail_1 || "";

    if (pos === "助動詞") return true;
    if (pos === "助詞" && ["て", "で", "たら", "ても", "でも", "ば", "える"].includes(surface)) return true;

    if (pos === "動詞" && ["しまう", "ちゃう", "いる", "ある", "くれる", "もらう", "くださる"].includes(basic)) {
        return true;
    }

    if (pos === "動詞" && posDetail1 === "接尾") return true;

    return false;
}

function buildJapaneseHighlightSpans(tokens) {
    const spans = [];

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const start = Math.max(0, Number(token.word_position || 1) - 1);
        const surface = String(token.surface_form || "");
        const end = start + surface.length;

		if (token.pos !== "助詞" || surface.length > 1) {
			spans.push({
				start,
				end,
				surface,
				candidates: getJapaneseTokenCandidates(token)
			});
		}

        if (token.pos !== "動詞") continue;

        let chainEnd = end;
        let chainSurface = surface;
        const candidates = getJapaneseTokenCandidates(token);

        let j = i + 1;

        while (j < tokens.length && isVerbChainTailToken(tokens[j])) {
            const next = tokens[j];
            const nextSurface = String(next.surface_form || "");

            chainSurface += nextSurface;
            chainEnd += nextSurface.length;
			candidates.push(...getJapaneseTokenCandidates(next));

            j += 1;
        }

        if (j > i + 1) {
			candidates.push(...getJapaneseTokenCandidates({
				surface_form: chainSurface,
				basic_form: chainSurface
			}));			
			
            spans.push({
                start,
                end: chainEnd,
                surface: chainSurface,
                candidates: [...new Set(candidates)]
            });
        }
    }
	
	spans.push(...buildJapaneseCompoundSpans(tokens));
	
    return spans;
}

function buildJapaneseCompoundSpans(tokens) {
    const spans = [];
    const maxWindowSize = 2;

    for (let i = 0; i < tokens.length; i += 1) {
        let surface = "";
        const firstToken = tokens[i];
        const start = Math.max(0, Number(firstToken.word_position || 1) - 1);

        for (let j = i; j < Math.min(tokens.length, i + maxWindowSize); j += 1) {
            const token = tokens[j];
            const tokenSurface = String(token.surface_form || "");

            if (!tokenSurface.trim()) break;

            surface += tokenSurface;

            if (j === i) continue;

            const candidate = normalizeHighlightWord(surface);

            if (!candidate || candidate === "*") continue;

            spans.push({
                start,
                end: start + surface.length,
                surface,
                candidates: [candidate]
            });
        }
    }

    return spans;
}

function collectSubtitleCandidates(text) {
    const source = String(text || "");
    const tokens = tokenizeJapaneseTextSync?.(source);

    if (!tokens) return [];

    const spans = buildJapaneseHighlightSpans(tokens);
    const candidates = new Set();

    for (const span of spans) {
        for (const rawCandidate of span.candidates || []) {
            const candidate = normalizeHighlightWord(rawCandidate);

            if (candidate && candidate !== "*") {
                candidates.add(candidate);
            }
        }
    }

    return [...candidates];
}

async function ensureStatusesForSubtitleText(text, { rerender = true, silent = false } = {}) {
    await loadHighlightWordIndexes();

    if (!silent) {
        const candidates = collectSubtitleCandidates(text);
        const knownCount = candidates.filter((candidate) => ankiRuntimeWordStatusMap.has(candidate)).length;
        console.log(`Snapshot highlighter matched ${knownCount}/${candidates.length} subtitle candidates`);
    }

    if (rerender) {
        rerenderCurrentSubtitleWithAnkiHighlighter();
    }
}

async function ensureStatusesForCandidates(candidates, { silent = false } = {}) {
    await loadHighlightWordIndexes();

    if (!silent) {
        const uniqueCandidates = [...new Set(candidates)].filter(Boolean);
        const knownCount = uniqueCandidates.filter((candidate) => ankiRuntimeWordStatusMap.has(candidate)).length;
        console.log(`Snapshot batch matched ${knownCount}/${uniqueCandidates.length} candidates`);
    }
}

function rerenderCurrentSubtitleWithAnkiHighlighter() {
    if (typeof getCurrentSubtitle !== "function") return;
    if (typeof renderSubtitleOverlay !== "function") return;
    if (typeof overlay === "undefined") return;

    const sub = getCurrentSubtitle();

    renderSubtitleOverlay({
        overlay,
        text: sub ? sub.text : "",
        highlighter: ankiSubtitleHighlighter
    });
}

function findAnkiMatchesInText(text) {
    const source = String(text || "");
    const tokens = tokenizeJapaneseTextSync?.(source);

    if (!tokens) {
        return [];
    }

    const spans = buildJapaneseHighlightSpans(tokens);
    const matches = [];

    for (const span of spans) {
        let bestMatch = null;

        for (const candidate of span.candidates) {
            const info = ankiRuntimeWordStatusMap.get(candidate);
            if (!info || info.status === "unknown") continue;

            bestMatch = {
                start: span.start,
                end: span.end,
                status: info.status
            };

            break;
        }

        if (bestMatch) {
            matches.push(bestMatch);
        }
    }

    return matches
        .sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return (b.end - b.start) - (a.end - a.start);
        })
        .filter((match, index, arr) => {
            for (let i = 0; i < index; i += 1) {
                const prev = arr[i];

                const overlaps =
                    match.start < prev.end &&
                    match.end > prev.start;

                if (overlaps) return false;
            }

            return true;
        });
}

const ankiSubtitleHighlighter = {
    get enabled() {
        return getSubtitleHighlightSettings().enabled;
    },

    get statusSettings() {
        return getSubtitleHighlightSettings().statusSettings;
    },

    getStatusForTextToken(token) {
        const clean = String(token || "")
            .trim()
            .replace(/[.,!?;:()[\]'"「」『』。、！？]/g, "");

        return ankiRuntimeWordStatusMap.get(clean)?.status || "unknown";
    },

    findMatchesInText(text) {
        return findAnkiMatchesInText(text);
    }
};

function addRuntimeKnownBasicWord(word) {
    const normalized = normalizeHighlightWord(word);

    if (!normalized) return;

    const prev = ankiRuntimeWordStatusMap.get(normalized);

    ankiRuntimeWordStatusMap.set(normalized, {
        ...(prev || {}),
        status: pickBetterStatus(prev?.status, "mature"),
        source: "known-basic"
    });
}


