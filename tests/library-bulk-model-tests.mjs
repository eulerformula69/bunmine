import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/library/library-bulk-model.js", "utf8")
    .replace("const LibraryBulkModel =", "globalThis.LibraryBulkModel =");
const context = vm.createContext({});
vm.runInContext(source, context);
const model = context.LibraryBulkModel;
const translate = (key) => key;

const nf1 = { releaseKey: "nf", releaseLabel: "Netflix", filename: "Show 01.srt", downloadUrl: "one" };
const nf2 = { releaseKey: "nf", releaseLabel: "Netflix", filename: "Show 02.srt", downloadUrl: "two" };
const dsnp = { releaseKey: "dsnp", releaseLabel: "DSNP", filename: "Show 01.ass", entryId: 4 };
const plan = { items: [
    { episodeId: 1, candidates: [nf1, dsnp] },
    { episodeId: 2, candidates: [nf2] },
] };

const sets = model.getSets(plan, translate);
assert.equal(sets[0].key, "nf");
assert.equal(sets[0].count, 2);
assert.equal(sets[0].totalEpisodes, 2);
assert.equal(model.candidateKey(dsnp), "4:Show 01.ass");
assert.equal(model.formatCandidate({ filename: "Show.srt", sizeBytes: 1024 }, () => "1 KB"), "Show.srt · 1 KB");

model.applySet(plan, "nf", translate);
assert.equal(plan.items[0].selected, nf1);
assert.equal(plan.items[1].selected, nf2);
assert.equal(plan.items[0].status, "ready");

model.applySet(plan, "dsnp", translate);
assert.equal(plan.items[1].selected, null);
assert.equal(plan.items[1].status, "needs-review");

console.log("Library bulk model tests passed");
