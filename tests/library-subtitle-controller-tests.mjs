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
    select: async () => ({ response: { ok: true }, data: {subtitleFileId: 5, subtitleFilename: "Anime 01.srt"} }), refreshSeriesStatus: () => {},
});

const {renderFileRow} = await import("../dist/esm/library/library.js");
const episode = { id: 4, episodeNumber: 1, hasSubtitle: false, hasVideo: true };
const row = renderFileRow(episode);
await controller.open(episode, row);
assert.equal(title.textContent, "findJapaneseSubtitles");
assert.equal(subtitle.textContent, "Anime · episodeLabel:1");
await controller.search();
assert.equal(queryUsed, "Anime");
assert.equal(results.children.length, 1);
results.children[0].click();
await new Promise(resolve => setImmediate(resolve));
assert.equal(episode.hasSubtitle, true);
assert.equal(episode.subtitleFileId, 5);
assert.equal(row.querySelector(".subtitle-file-action").textContent, "changeJpSubs");
assert.equal(row.querySelector(".subtitle-filename").textContent, "Anime 01.srt");
controller.close();
assert.ok(modal.classList.contains("hidden"));

console.log("Library subtitle controller tests passed");

dom.window.close();
