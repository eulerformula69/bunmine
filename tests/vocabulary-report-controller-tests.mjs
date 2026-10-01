import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom("library");

const checked = (name, value) => ({ name, value, checked: true });
const root = {
    querySelectorAll(selector) { return selector.includes("reportStatus") ? [checked("reportStatus", "new"), checked("reportStatus", "young")] : [checked("reportSheet", "summary")]; },
    querySelector(selector) { return ["#reportIncludeParticles", "#reportIncludeAuxiliaryForms"].includes(selector) ? { checked: false } : null; }
};
const context = await import("../dist/esm/library/vocabulary-report-controller.js");
const payload = context.buildVocabularyReportPayload(root);
assert.deepEqual(JSON.parse(JSON.stringify(payload)), { statuses: ["new", "young"], includeParticles: false, includeAuxiliaryForms: false, sheets: { summary: true, occurrences: false, statistics: false } });
assert.equal(context.vocabularyReportFilename("attachment; filename=Dungeon_Meshi_vocabulary_report_2026-07-15.xlsx"), "Dungeon_Meshi_vocabulary_report_2026-07-15.xlsx");
assert.equal(context.vocabularyReportFilename("attachment; filename=report.xlsx; filename*=UTF-8''%E8%91%AC%E9%80%81%E3%81%AE%E3%83%95%E3%83%AA%E3%83%BC%E3%83%AC%E3%83%B3_vocabulary_report.xlsx"), "葬送のフリーレン_vocabulary_report.xlsx");
console.log("vocabulary report controller tests passed");

dom.window.close();
