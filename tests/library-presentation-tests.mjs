import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/library/library-presentation.js", "utf8")
    .replace("const LibraryPresentation =", "globalThis.LibraryPresentation =");
const context = vm.createContext({});
vm.runInContext(source, context);
const presentation = context.LibraryPresentation;
const translate = (key) => key;

assert.equal(presentation.formatTime(0), "0m");
assert.equal(presentation.formatTime(3720), "1h 2m");
assert.equal(presentation.formatBytes(1536), "2 KB");
assert.equal(presentation.escapeHtml('<a title="x">&'), "&lt;a title=&quot;x&quot;&gt;&amp;");
assert.equal(presentation.linkStatus([]), "missing");
assert.equal(presentation.linkStatus([{ hasVideo: true, hasSubtitle: false }]), "partial");
assert.equal(presentation.linkStatus([{ hasVideo: true, hasSubtitle: true }]), "linked");
assert.equal(presentation.statusLabel("partial", translate), "partiallyLinked");
assert.equal(presentation.planStatusLabel("needs-review", translate), "needsReview");
const base = { id: 1, title: "Beta", episodesCount: 2, completedEpisodes: 0, episodesWithVideo: 2, episodesWithSubtitle: 1 };
assert.equal(presentation.seriesStatus(base), "not-started");
assert.equal(presentation.seriesStatus({ ...base, currentTimeSeconds: 20 }), "watching");
assert.equal(presentation.seriesStatus({ ...base, completedEpisodes: 2 }), "completed");
assert.equal(presentation.episodeCanResume({ completed: false, currentTimeSeconds: 20 }), true);
assert.equal(presentation.episodeCanResume({ completed: true, currentTimeSeconds: 20 }), false);
assert.equal(presentation.matchesFilter(base, "missing-subtitles"), true);
assert.deepEqual(presentation.filterAndSort([base, { ...base, id: 2, title: "Alpha" }], { filter: "all", sort: "title", query: "a" }).map((item) => item.title), ["Alpha", "Beta"]);
assert.equal(presentation.primaryAction(base, [{ id: 10, hasVideo: true, completed: false }]).kind, "start");
assert.equal(presentation.primaryAction({ ...base, currentTimeSeconds: 20 }, [{ id: 10, hasVideo: true, currentTimeSeconds: 20 }]).kind, "continue");
assert.equal(presentation.primaryAction({ ...base, completedEpisodes: 2 }, [{ id: 10, hasVideo: true, completed: true }]).kind, "open");

console.log("Library presentation tests passed");
