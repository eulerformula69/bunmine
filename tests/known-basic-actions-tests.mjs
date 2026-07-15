import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/player/known-basic-actions.js", "utf8")
    .replace("function createKnownBasicActions", "globalThis.createKnownBasicActions = function");
const context = vm.createContext({ console });
vm.runInContext(source, context);

const events = [];
const actions = context.createKnownBasicActions({
    tokenize: async () => [{ surface_form: "食べた", pos: "動詞", basic_form: "食べる" }],
    request: async (_path, options) => {
        events.push(JSON.parse(options.body).word);
        return { response: { ok: true }, data: { added: true } };
    },
    translate: (key) => key,
    toast: (message) => events.push(message),
    markMature: (word) => events.push(`mature:${word}`),
    hideButton: () => events.push("hidden"),
    clearSelection: () => events.push("cleared"),
    copyText: async (text) => events.push(`copied:${text}`),
});

assert.equal(await actions.dictionaryForm("食べた"), "食べる");
await actions.addWord("食べた");
assert.deepEqual(events.slice(0, 4), ["食べる", "mature:食べる", "cleared", "hidden"]);
await actions.copyWord(" 猫 ");
assert.ok(events.includes("copied:猫"));

console.log("Known-basic actions tests passed");
