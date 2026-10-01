import { installDom } from "./dom-environment.mjs";
import assert from "node:assert/strict";

const dom = installDom("library");
const element = () => document.createElement("input");
const body = document.body;
const context = await import("../dist/esm/library/library-subtitle-controller.js");

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
assert.ok(modal.classList.contains("hidden"));

console.log("Library subtitle controller tests passed");

dom.window.close();
