import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/player/anki-actions.js", "utf8")
    .replace(
        "function normalizeAnkiFuriganaWhitespace",
        "globalThis.normalizeAnkiFuriganaWhitespace = function"
    );
const context = vm.createContext({ console });
vm.runInContext(source, context);

const normalize = context.normalizeAnkiFuriganaWhitespace;

assert.equal(normalize("猫\u3000を見る"), "猫 を見る");
assert.equal(normalize("猫\u00a0を見る"), "猫 を見る");
assert.equal(normalize("猫\u202fを見る"), "猫 を見る");
assert.equal(normalize("猫 を見る"), "猫 を見る");
assert.equal(normalize("猫\nを見る"), "猫\nを見る");

console.log("Anki furigana whitespace tests passed");
