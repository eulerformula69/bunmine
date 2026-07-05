import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const highlighterPath = fileURLToPath(new URL("../frontend/js/highlighter/anki-highlighter.js", import.meta.url));
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

console.log("Highlighter match tests passed");
