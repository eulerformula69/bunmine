import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const element = () => ({
    classList: { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } },
    textContent: "", innerHTML: "", value: "", disabled: false, children: [],
    appendChild(child) { this.children.push(child); }, addEventListener(_name, callback) { this.callback = callback; },
    focus() {}, select() {}, querySelector() { return null; },
});
const body = element();
const context = vm.createContext({ document: { body, createElement: element }, console });
const source = fs.readFileSync("dist/js/library/library-subtitle-controller.js", "utf8")
    .replace("function createLibrarySubtitleController", "globalThis.createLibrarySubtitleController = function");
vm.runInContext(source, context);

const modal = element(), title = element(), subtitle = element(), input = element(), button = element(), results = element();
let queryUsed = "";
const controller = context.createLibrarySubtitleController({
    modal, title, subtitle, searchInput: input, searchButton: button, results,
    getSeries: () => ({ id: 1, title: "Anime" }), translate: (key, params) => params?.number ? `${key}:${params.number}` : key,
    escapeHtml: String, formatBytes: () => "1 KB",
    search: async (_id, query) => {
        queryUsed = query;
        return { response: { ok: true }, data: { results: [{ filename: "Anime 01.srt", sizeBytes: 1024 }] } };
    },
    select: async () => ({ response: { ok: true }, data: {} }), refreshSeriesStatus: () => {},
});

await controller.open({ id: 4, episodeNumber: 1, hasSubtitle: false }, element());
assert.equal(title.textContent, "findJapaneseSubtitles");
assert.equal(subtitle.textContent, "Anime · episodeLabel:1");
await controller.search();
assert.equal(queryUsed, "Anime");
assert.equal(results.children.length, 1);
controller.close();
assert.ok(modal.classList.values.has("hidden"));

console.log("Library subtitle controller tests passed");
