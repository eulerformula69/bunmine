import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const context = await import("../dist/esm/subtitles/sidebar-render.js");
const {state} = await import("../dist/esm/core/state.js");
const {formatTime} = await import("../dist/esm/core/formatters.js");
const {initSubtitleSearchPanel} = await import("../dist/esm/subtitles/search-controller.js");
initSubtitleSearchPanel();
const list = document.getElementById("subtitleList");
let created = 0;
const createElement = document.createElement.bind(document);
document.createElement = (...args) => { created++; return createElement(...args); };
state.subtitles = Array.from({length: 5000}, (_,index) => ({start:index,end:index+1,text:`Line ${index}`}));
state.lastClickedSubtitleIdx = 0;
state.subtitleContextBackDepth = state.subtitleContextForwardDepth = 0;
context.renderSubtitles();
assert.equal(list.children.length, 5000);
const originalRows = [...list.children];
created = 0;
state.lastClickedSubtitleIdx = 4500;
state.subtitleContextBackDepth = state.subtitleContextForwardDepth = 1;
context.renderSubtitles();
assert.ok(created <= 4, `Selection created ${created} elements`);
assert.ok(Array.from(list.children).every((row, index) => row === originalRows[index]));
assert.ok(!list.children[0].className.includes('active'));
assert.ok(list.children[4500].className.includes('active'));
assert.ok(list.children[4499].querySelector('.subtitle-depth-handle-row[data-kind="back"]'));
state.subtitleSearchMatches = [{ type: 'word', subtitleIndex: 4999, start: 0, end: 4 }];
state.subtitleSearchIndex = 0;
created = 0;
context.renderSubtitles();
assert.equal(created, 1);
assert.equal(list.children[4999].querySelector('.text-content').querySelector('.subtitle-search-match').textContent, 'Line');
state.subtitleSearchMatches = [];
context.renderSubtitles();
assert.equal(list.children[4999].querySelector('.text-content').textContent, 'Line 4999');
assert.ok(!list.children[4999].className.includes('search-active'));
state.globalSubDelay = 5;
context.renderSubtitles();
assert.equal(list.children[0].children[0].children[0].textContent, formatTime(5));
state.subtitles = [{ start: 0, end: 1, text: 'Replacement' }];
state.lastClickedSubtitleIdx = 0;
state.subtitleContextBackDepth = state.subtitleContextForwardDepth = 0;
context.renderSubtitles();
assert.equal(list.children.length, 1);
assert.equal(list.children[0].querySelector('.text-content').textContent, 'Replacement');
state.subtitles = [];
context.renderSubtitles();
assert.equal(list.children.length, 0);

document.getElementById("subtitleAnnotationsVisible").checked = false;
state.subtitles = [
    { start: 0, end: 1, text: '（太郎） 行くぞ' },
    { start: 1, end: 2, text: '【物音】' }
];
context.renderSubtitles();
assert.equal(list.children[0].querySelector('.text-content').textContent, '行くぞ');
assert.equal(list.children[1].hidden, true);

const { getSubtitleIndexFromSelection } = await import("../dist/esm/player/selection-model.js");
const { getCleanSelectedText } = await import("../dist/esm/player/ui.js");
const { bindSelectionButtonAction } = await import("../dist/esm/player/selection-button.js");
const { createCandidateCaptureController } = await import("../dist/esm/player/capture-controller.js");
const saved = [];
const capture = createCandidateCaptureController({
    buildSnapshot: (index) => ({ currentIdx: index, combinedText: state.subtitles[index].text }),
    save: async (snapshot) => { saved.push(snapshot); },
    saved: async () => {},
});
const button = document.getElementById("addCardToDeck");
bindSelectionButtonAction(button, () => capture(getCleanSelectedText(), getSubtitleIndexFromSelection()));
const video = document.getElementById("video");
for (const searching of [false, true]) {
    state.subtitles = [
        { start: 0, end: 1, text: '猫です' },
        { start: 10, end: 12, text: '犬です' },
    ];
    state.lastClickedSubtitleIdx = 0;
    state.subtitleSearchMatches = searching
        ? [{ type: 'word', subtitleIndex: 1, start: 0, end: 1 }] : [];
    state.subtitleSearchIndex = searching ? 0 : -1;
    context.renderSubtitles();
    const row = list.children[1];
    const text = row.querySelector('.text-content');
    const range = document.createRange();
    const selectedText = searching ? text.querySelector('.subtitle-search-match').firstChild : text.firstChild;
    range.setStart(selectedText, 0);
    range.setEnd(selectedText, 1);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    video.currentTime = 3;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(selection.toString(), '犬', 'A sidebar click must preserve the selected word');
    assert.equal(video.currentTime, 3, 'Selecting a word must not seek the video');
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(saved.at(-1), { currentIdx: 1, combinedText: '犬です', selectedWord: '犬' });
    assert.equal(saved.length, searching ? 2 : 1, 'One button click must save one candidate');
    selection.removeAllRanges();
    row.click();
    assert.equal(video.currentTime, 10 + state.globalSubDelay + 0.05, 'A plain row click must still seek');
}
console.log('Subtitle sidebar: 5,000 rows, incremental selection/search, delay, replacement, and clearing passed.');

dom.window.close();
