import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const checked = (name, value) => ({ name, value, checked: true });
const root = {
    querySelectorAll(selector) { return selector.includes("reportStatus") ? [checked("reportStatus", "new"), checked("reportStatus", "young")] : [checked("reportSheet", "summary")]; },
    querySelector(selector) { return selector === "#reportIncludeParticles" ? { checked: false } : null; }
};
const context = { console, document: {}, setTimeout, URL, fetch: async () => { throw new Error("unused"); } };
vm.createContext(context);
vm.runInContext(fs.readFileSync("dist/js/library/vocabulary-report-controller.js", "utf8"), context);
context.testRoot = root;
const payload = vm.runInContext("buildVocabularyReportPayload(testRoot)", context);
assert.deepEqual(JSON.parse(JSON.stringify(payload)), { statuses: ["new", "young"], includeParticles: false, sheets: { summary: true, occurrences: false, statistics: false } });
console.log("vocabulary report controller tests passed");
