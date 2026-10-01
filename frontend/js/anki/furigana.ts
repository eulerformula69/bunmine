import { tokenizeJapaneseText } from "../japanese/japanese-tokenizer.js";

export function hasKanji(text: string): boolean {
    return /[\u3400-\u9fff]/.test(String(text || ""));
}

export function normalizeAnkiFuriganaWhitespace(text: string): string {
    return String(text || "").replace(
        /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g,
        " "
    );
}

export function encodeAnkiFuriganaSpaces(text: string): string {
    return String(text || "").replace(/ /g, "&nbsp;");
}

export function splitKanjiStemAndKanaTail(surface: string, readingHiragana: string): {
    stem: string;
    tail: string;
    stemReading: string;
} {
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

export async function buildSentenceFurigana(text: string, tokenize = tokenizeJapaneseText): Promise<string> {
    // Anki's bracket-furigana parser only treats an ASCII space as a reliable
    // reading-group separator. Subtitle formats commonly contain visually
    // identical full-width or non-breaking spaces, so normalize them before
    // token positions and separators are copied into the generated field.
    const source = normalizeAnkiFuriganaWhitespace(text);

    if (!source) return "";

    const tokens = await tokenize(source);
    let result = "";
    let lastEnd = 0;

    for (const token of tokens) {
        const surface = token.surface_form || "";
        const reading = token.reading || "";

        if (!surface) continue;

        const start = Math.max(0, Number(token.word_position || 1) - 1);
        const end = start + surface.length;

        if (start > lastEnd) {
            result += source.slice(lastEnd, start);
        }

        const previousChar = result.slice(-1);
        const shouldAddSpaceBeforeKanjiWord =
            hasKanji(surface) &&
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

    // Anki fields are HTML. Literal spaces sent through AnkiConnect can be
    // collapsed before the furigana filter sees them, while a space retyped in
    // Anki's editor is stored as &nbsp;. Emit the same stable separator here.
    return encodeAnkiFuriganaSpaces(result);
}

export function katakanaToHiragana(text: string): string {
    return String(text || "").replace(/[\u30a1-\u30f6]/g, (char) => {
        return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
}
