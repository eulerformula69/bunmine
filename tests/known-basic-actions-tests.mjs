import assert from "node:assert/strict";

const context = await import("../dist/esm/player/known-basic-actions.js");

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
});

assert.equal(await actions.dictionaryForm("食べた"), "食べる");
await actions.addWord("食べた");
assert.deepEqual(events.slice(0, 4), ["食べる", "mature:食べる", "cleared", "hidden"]);

console.log("Known-basic actions tests passed");
