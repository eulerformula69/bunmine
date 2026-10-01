import { installDom } from "./dom-environment.mjs";
import assert from "node:assert/strict";

const dom = installDom("library");
const element = () => document.createElement("input");
const body = document.body;
const context = await import("../dist/esm/library/library-cover-controller.js");

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
assert.ok(body.classList.contains("modal-open"));
controller.close();
assert.ok(modal.classList.contains("hidden"));

console.log("Library cover controller tests passed");

dom.window.close();
