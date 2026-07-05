import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const highlighterPath = fileURLToPath(new URL("../frontend/js/highlighter/anki-highlighter.js", import.meta.url));
const comprehensionLevelPath = fileURLToPath(new URL("../frontend/js/subtitles/comprehension-level.js", import.meta.url));
const tokenFixtures = new Map();

const context = {
    console,
    document: {
        getElementById() {
            return null;
        }
    },
    tokenizeJapaneseTextSync(text) {
        return tokenFixtures.get(text) ?? null;
    }
};

vm.createContext(context);
vm.runInContext(readFileSync(comprehensionLevelPath, "utf8"), context, { filename: comprehensionLevelPath });
vm.runInContext(readFileSync(highlighterPath, "utf8"), context, { filename: highlighterPath });

function resetKnownWords(...words) {
    context.clearRuntimeWordStatuses();

    for (const word of words) {
        context.addRuntimeKnownBasicWord(word);
    }
}

function matchedTexts(text) {
    return Array.from(context.findAnkiMatchesInText(text), (match) => text.slice(match.start, match.end));
}

{
    const text = "南極まで来て　足手まといは嫌でしょ";
    resetKnownWords("足手まとい");

    assert.deepEqual(matchedTexts(text), ["足手まとい"]);
}

{
    const text = "買わなかった";
    tokenFixtures.set(text, [
        { surface_form: "買わ", basic_form: "買う", pos: "動詞", word_position: 1 },
        { surface_form: "なかっ", basic_form: "ない", pos: "助動詞", word_position: 3 },
        { surface_form: "た", basic_form: "た", pos: "助動詞", word_position: 6 }
    ]);
    resetKnownWords("買う");

    assert.deepEqual(matchedTexts(text), ["買わなかった"]);
}

{
    const text = "足手まとい";
    resetKnownWords("足", "手まとい", "足手まとい");

    assert.deepEqual(matchedTexts(text), ["足手まとい"]);
}

{
    assert.equal(context.isKanjiContainingToken("\u3053\u308c"), false);
    assert.equal(context.isKanjiContainingToken("\u3059\u308b"), false);
    assert.equal(context.isKanjiContainingToken("\u898b\u308b"), true);
    assert.equal(context.isKanjiContainingToken("\u5b66\u6821"), true);
}

{
    const text = "\u3053\u308c\u306f\u898b\u308b\u3057\u5b66\u6821\u3067\u52c9\u5f37\u3059\u308b";
    tokenFixtures.set(text, [
        { surface_form: "\u3053\u308c", basic_form: "\u3053\u308c", pos: "\u540d\u8a5e", word_position: 1 },
        { surface_form: "\u306f", basic_form: "\u306f", pos: "\u52a9\u8a5e", word_position: 3 },
        { surface_form: "\u898b\u308b", basic_form: "\u898b\u308b", pos: "\u52d5\u8a5e", word_position: 4 },
        { surface_form: "\u3057", basic_form: "\u3057", pos: "\u52a9\u8a5e", word_position: 6 },
        { surface_form: "\u5b66\u6821", basic_form: "\u5b66\u6821", pos: "\u540d\u8a5e", word_position: 7 },
        { surface_form: "\u3067", basic_form: "\u3067", pos: "\u52a9\u8a5e", word_position: 9 },
        { surface_form: "\u52c9\u5f37", basic_form: "\u52c9\u5f37", pos: "\u540d\u8a5e", word_position: 10 },
        { surface_form: "\u3059\u308b", basic_form: "\u3059\u308b", pos: "\u52d5\u8a5e", word_position: 12 }
    ]);
    resetKnownWords("\u898b\u308b");

    assert.equal(context.getUnknownKanjiTokenCountForText(text), 2);
    assert.equal(context.getSubtitleComprehensionLevel(text, {
        getUnknownKanjiTokenCount: context.getUnknownKanjiTokenCountForText
    }), "i+2");
}

{
    assert.equal(context.getSubtitleComprehensionLevelFromUnknownCount(5), "i+5+");
    assert.equal(context.getSubtitleComprehensionLevelFromUnknownCount(9), "i+5+");
}

console.log("Highlighter match tests passed");
