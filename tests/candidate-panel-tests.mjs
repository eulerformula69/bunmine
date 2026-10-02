import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();

const context = { ...await import("../dist/esm/player/candidate-panel.js"), ...await import("../dist/esm/core/translate.js") };
const {state} = await import("../dist/esm/core/state.js");
context.setLanguage = language => { state.currentLang = language; };
context.setLanguage("ru");
const sidebar = document.getElementById("sidebar");
const header = sidebar.querySelector(".subtitle-sidebar-header");
const toggle = document.getElementById("toggleSubs");
toggle.onclick = () => sidebar.classList.toggle("hidden", false);
let candidates = [1, 2].map((id) => ({
    id, snapshot: { selectedWord: `word${id}`, combinedText: `<b>context${id}</b>`, targetTime: id,
        videoPayload: { filename: "test.mkv" } },
}));
let busy = false;
let autoAcquireEnabled = false;
let finish;
const selected = [];
const acquired = [];
const manuallyAttached = [];
let panel;
panel = context.createCandidatePanel({
    sidebar, busy: () => busy,
    list: async () => candidates,
    createEditor: () => {
        const element = document.createElement("div");
        return {element, set: candidate => { element.textContent = candidate?.snapshot.combinedText || ""; }};
    },
    select: async (candidate) => selected.push(candidate.id),
    autoAcquireEnabled: () => autoAcquireEnabled,
    acquire: async (candidate, selectedWord) => {
        busy = true;
        acquired.push([candidate.id, selectedWord]);
        await new Promise((resolve) => { finish = resolve; });
        busy = false;
    },
    attachManual: async (candidate) => { manuallyAttached.push(candidate.id); },
    reject: async (candidate) => {
        candidates = candidates.filter((item) => item.id !== candidate.id);
        await panel.refresh();
    },
    error: (error) => { throw error; },
});
await panel.refresh();
const tabs = header.nextElementSibling.children;
const section = sidebar.querySelector("#candidatePanel");
const [list, actions, savedContext] = section.children;
const [manual, skip] = actions.children;
const settle = () => new Promise((resolve) => setImmediate(resolve));
const waitForArm = () => new Promise((resolve) => setTimeout(resolve, 300));
assert.equal(tabs.length, 2);
assert.equal(section.hidden, true);
tabs[1].click();
assert.equal(section.hidden, false);
assert.equal(sidebar.classList.contains("review-candidates"), true);
list.children[0].click();
await settle();
assert.deepEqual(selected, [1]);
assert.equal(savedContext.textContent, "<b>context1</b>");
assert.equal(actions.previousElementSibling, list);
assert.equal(actions.nextElementSibling, savedContext);
assert.equal(panel.exportCandidateId(), 1);
assert.equal(panel.isCandidateMode(), true);
panel.armAutoAcquire("disabled");
await waitForArm();
assert.deepEqual(acquired, []);
autoAcquireEnabled = true;
panel.armAutoAcquire(" selected word ");
await waitForArm();
assert.equal(skip.disabled, true);
assert.equal(list.children[1].disabled, true);
assert.deepEqual(acquired, [[1, "selected word"]]);
finish();
await settle();
manual.click();
await settle();
assert.deepEqual(manuallyAttached, [1]);
skip.click();
await settle();
assert.deepEqual(selected, [1, 2]);
assert.equal(savedContext.textContent, "<b>context2</b>");
assert.equal(panel.exportCandidateId(), 2);
assert.equal(toggle.nextElementSibling.textContent, "Кандидаты: 1");
tabs[0].click();
assert.equal(section.hidden, true);
assert.equal(panel.isCandidateMode(), false);
assert.equal(panel.exportCandidateId(), undefined);
sidebar.classList.toggle("hidden", true);
toggle.nextElementSibling.click();
assert.equal(sidebar.classList.contains("hidden"), false);
assert.equal(section.hidden, false);
skip.click();
await settle();
assert.equal(skip.disabled, true);
assert.equal(toggle.nextElementSibling.textContent, "Кандидаты: 0");
context.setLanguage("ja");
panel.render();
assert.equal(tabs[0].textContent, "字幕");
assert.equal(tabs[1].textContent, "候補 · 0");
assert.equal(manual.textContent, "手動で追加");
assert.equal(skip.textContent, "スキップ");
assert.equal(section.getAttribute("aria-label"), "候補");
context.setLanguage("en");
panel.render();
assert.equal(tabs[0].textContent, "Subtitles");
assert.equal(tabs[1].textContent, "Candidates · 0");
assert.equal(manual.textContent, "Add manually");
assert.equal(skip.textContent, "Skip");
assert.equal(context.t("sidebarTitle"), "Sidebar");
const candidateSettingsTab = document.querySelector('[data-settings-tab="candidates"]');
assert.ok(candidateSettingsTab);
assert.ok(document.querySelector('[data-settings-page="candidates"] #autoAttachNextCardEnabled'));
console.log("Candidate panel and language switching tests passed");

dom.window.close();
