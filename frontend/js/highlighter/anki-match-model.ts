function normalizeJapaneseNumberText(value: unknown): string {
    return String(value || "")
        .replace(/[０-９]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        );
}

function addCandidate(candidates: string[], value: unknown) {
    const normalized = normalizeHighlightWord(normalizeJapaneseNumberText(value));

    if (normalized && normalized !== "*") {
        candidates.push(normalized);
    }
}

function getTokenStart(token: JapaneseToken): number {
    return Math.max(0, Number(token.word_position || 1) - 1);
}

function getTokenEnd(token: JapaneseToken): number {
    return getTokenStart(token) + String(token.surface_form || "").length;
}



function getJapaneseTokenCandidates(token: JapaneseToken): string[] {
    const surface = String(token.surface_form || "");
    const basic = String(token.basic_form || "");
    const candidates: string[] = [];

    function add(value: unknown) {
        const normalized = normalizeHighlightWord(normalizeJapaneseNumberText(value));

        if (normalized && normalized !== "*") {
            candidates.push(normalized);
        }
    }

	function addGodanPotentialCandidates(value: string) {
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

    function addGodanConditionalCandidates(value: string) {
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

function isVerbChainTailToken(token: JapaneseToken | undefined): boolean {
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

function buildJapaneseHighlightSpans(tokens: JapaneseToken[]): HighlightSpan[] {
    const spans: HighlightSpan[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const start = getTokenStart(token);
        const surface = String(token.surface_form || "");
        const end = getTokenEnd(token);

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
            chainEnd = getTokenEnd(next);
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

function buildJapaneseCompoundSpans(tokens: JapaneseToken[]): HighlightSpan[] {
    const spans: HighlightSpan[] = [];
    const maxWindowSize = 2;

    for (let i = 0; i < tokens.length; i += 1) {
        let surface = "";
        const firstToken = tokens[i];
        const start = getTokenStart(firstToken);

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

function resolveOverlappingAnkiMatches(matches: AnkiTextMatch[]): AnkiTextMatch[] {
    const selected: AnkiTextMatch[] = [];

    for (const match of matches
        .filter((item) => item.end > item.start)
        .sort((a, b) => {
            const lengthDiff = (b.end - b.start) - (a.end - a.start);
            if (lengthDiff !== 0) return lengthDiff;
            return a.start - b.start;
        })) {
        const overlaps = selected.some((prev) =>
            match.start < prev.end &&
            match.end > prev.start
        );

        if (!overlaps) {
            selected.push(match);
        }
    }

    return selected.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
    });
}


