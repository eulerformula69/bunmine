import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const elements = [];
class Element {
    children = [];
    attrs = {};
    classes = new Set();
    disabled = false;
    hidden = false;
    constructor() { elements.push(this); }
    classList = {
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
        contains: (name) => this.classes.has(name),
    };
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attrs[key] = value; }
    querySelector() { return header; }
    after(element) { this.next = element; }
    click() { if (!this.disabled) this.onclick?.(); }
}
const header = new Element();
const sidebar = new Element();
const controls = new Element();
const toggle = new Element();
toggle.onclick = () => sidebar.classList.toggle("hidden", false);
let candidates = [1, 2].map((id) => ({
    id, snapshot: { selectedWord: `word${id}`, combinedText: `<b>context${id}</b>`, targetTime: id,
        videoPayload: { filename: "test.mkv" } },
}));
const context = vm.createContext({
    document: { createElement: () => new Element(), getElementById: (id) => id === "controls" ? controls : toggle },
    candidateApi: { list: async () => candidates },
    formatTime: String,
    createCandidateContextEditor: () => {
        const element = new Element();
        return { element, set: (candidate) => { element.textContent = candidate?.snapshot.combinedText || ""; } };
    },
});
for (const path of ["core/i18n", "player/sidebar-i18n"]) {
    vm.runInContext(fs.readFileSync(`dist/js/${path}.js`, "utf8"), context);
}
vm.runInContext(`let currentLang = "ru";
function setLanguage(language) { currentLang = language; }
function t(key, params = {}) {
    let text = i18n[currentLang].dict[key] || key;
    for (const [name, value] of Object.entries(params)) text = text.replaceAll("{" + name + "}", String(value));
    return text;
}`, context);
vm.runInContext(fs.readFileSync("dist/js/player/candidate-panel.js", "utf8"), context);
let busy = false;
let finish;
const selected = [];
const acquired = [];
let panel;
panel = context.createCandidatePanel({
    sidebar, busy: () => busy,
    select: async (candidate) => selected.push(candidate.id),
    acquire: async (candidate) => {
        busy = true;
        acquired.push(candidate.id);
        await new Promise((resolve) => { finish = resolve; });
        busy = false;
    },
    reject: async (candidate) => {
        candidates = candidates.filter((item) => item.id !== candidate.id);
        await panel.refresh();
    },
    error: (error) => { throw error; },
});
await panel.refresh();
const tabs = header.next.children;
const section = sidebar.children[0];
const [list, savedContext, actions] = section.children;
const [add, skip] = actions.children;
const settle = () => new Promise((resolve) => setImmediate(resolve));
assert.equal(tabs.length, 2);
assert.equal(section.hidden, true);
tabs[1].click();
assert.equal(section.hidden, false);
assert.equal(sidebar.classList.contains("review-candidates"), true);
list.children[0].click();
await settle();
assert.deepEqual(selected, [1]);
assert.equal(savedContext.textContent, "<b>context1</b>");
add.click();
assert.equal(add.disabled, true);
assert.equal(skip.disabled, true);
assert.equal(list.children[1].disabled, true);
add.click();
assert.deepEqual(acquired, [1]);
finish();
await settle();
skip.click();
await settle();
assert.deepEqual(selected, [1, 2]);
assert.equal(savedContext.textContent, "<b>context2</b>");
assert.equal(toggle.next.textContent, "Кандидаты: 1");
tabs[0].click();
assert.equal(section.hidden, true);
sidebar.classList.toggle("hidden", true);
toggle.next.click();
assert.equal(sidebar.classList.contains("hidden"), false);
assert.equal(section.hidden, false);
skip.click();
await settle();
assert.equal(add.disabled, true);
assert.equal(toggle.next.textContent, "Кандидаты: 0");
context.setLanguage("ja");
panel.render();
assert.equal(tabs[0].textContent, "字幕");
assert.equal(tabs[1].textContent, "候補 · 0");
assert.equal(skip.textContent, "スキップ");
assert.equal(add.textContent, "Yomitanで追加");
assert.equal(section.attrs["aria-label"], "候補");
context.setLanguage("en");
panel.render();
assert.equal(tabs[0].textContent, "Subtitles");
assert.equal(tabs[1].textContent, "Candidates · 0");
assert.equal(skip.textContent, "Skip");
assert.equal(context.t("sidebarTitle"), "Sidebar");
console.log("Candidate panel and language switching tests passed");
