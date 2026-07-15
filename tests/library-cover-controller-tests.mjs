import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const element = () => ({
    classList: { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } },
    textContent: "", innerHTML: "", value: "", disabled: false, children: [],
    appendChild(child) { this.children.push(child); },
    addEventListener(_name, callback) { this.callback = callback; },
});
const body = element();
const context = vm.createContext({
    document: { body, createElement: element },
    console,
});
const source = fs.readFileSync("dist/js/library/library-cover-controller.js", "utf8")
    .replace("function createLibraryCoverController", "globalThis.createLibraryCoverController = function");
vm.runInContext(source, context);

const modal = element();
const title = element();
const subtitle = element();
const input = element();
const button = element();
const results = element();
let searchQuery = "";
const controller = context.createLibraryCoverController({
    modal, title, subtitle, searchInput: input, searchButton: button, results,
    translate: (key) => key,
    escapeHtml: String,
    search: async (_id, query) => {
        searchQuery = query;
        return { response: { ok: true }, data: { results: [{ title: "Anime", coverUrl: "cover.jpg" }] } };
    },
    select: async () => ({ response: { ok: true }, data: {} }),
    reload: async () => {},
});

await controller.open({ id: 7, title: "Anime", coverUrl: null });
assert.equal(searchQuery, "Anime");
assert.equal(title.textContent, "findCover");
assert.equal(results.children.length, 1);
assert.ok(body.classList.values.has("modal-open"));
controller.close();
assert.ok(modal.classList.values.has("hidden"));

console.log("Library cover controller tests passed");
