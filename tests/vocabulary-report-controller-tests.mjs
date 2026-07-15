import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const checked = (name, value) => ({ name, value, checked: true });
const root = {
    querySelectorAll(selector) { return selector.includes("reportStatus") ? [checked("reportStatus", "new"), checked("reportStatus", "young")] : [checked("reportSheet", "summary")]; },
    querySelector(selector) { return ["#reportIncludeParticles", "#reportIncludeAuxiliaryForms"].includes(selector) ? { checked: false } : null; }
};
const context = { console, document: {}, setTimeout, URL, fetch: async () => { throw new Error("unused"); } };
vm.createContext(context);
vm.runInContext(fs.readFileSync("dist/js/library/vocabulary-report-controller.js", "utf8"), context);
context.testRoot = root;
const payload = vm.runInContext("buildVocabularyReportPayload(testRoot)", context);
assert.deepEqual(JSON.parse(JSON.stringify(payload)), { statuses: ["new", "young"], includeParticles: false, includeAuxiliaryForms: false, sheets: { summary: true, occurrences: false, statistics: false } });
assert.equal(vm.runInContext('vocabularyReportFilename("attachment; filename=Dungeon_Meshi_vocabulary_report_2026-07-15.xlsx")', context), "Dungeon_Meshi_vocabulary_report_2026-07-15.xlsx");
assert.equal(vm.runInContext('vocabularyReportFilename("attachment; filename=report.xlsx; filename*=UTF-8\'\'%E8%91%AC%E9%80%81%E3%81%AE%E3%83%95%E3%83%AA%E3%83%BC%E3%83%AC%E3%83%B3_vocabulary_report.xlsx")', context), "葬送のフリーレン_vocabulary_report.xlsx");
console.log("vocabulary report controller tests passed");
