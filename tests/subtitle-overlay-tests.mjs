import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const overlay = document.getElementById("subtitleOverlay");
const badge = document.getElementById("comprehensionLevelBadge");
const {renderSubtitleOverlay} = await import("../dist/esm/subtitles/subtitles.js");
const cues = [
    { start: 414.28, end: 416.25, text: "ちょっと被服室にもってくる！" },
    { start: 415.16, end: 416.23, text: "えッ ちょ まッ…" }
];
let primary = 0;
let hiddenLevel = null;
const highlighter = {
    enabled: true,
    statusSettings: { mature: { enabled: true, color: "#2f9d4f" } },
    findMatchesInText: () => [{ start: 0, end: 2, status: "mature" }]
};
const context = {
    getPrimarySubtitleIndex: () => primary,
    selectPrimarySubtitle: (index) => { primary = index; },
    getActiveSubtitles: () => cues,
    getActiveSubtitleEntries: () => cues.map((cue, index) => ({ cue, index })),
    getSubtitleComprehensionLevel: (text) => text === cues[0].text ? "i+0" : "i+1",
    shouldShowSubtitleForComprehensionLevel: (level) => level !== hiddenLevel
};
const render = (options = {}) => renderSubtitleOverlay({
    overlay, cues, cueIndices: [0, 1], highlighter, ...options
}, context);
const lines = () => Array.from(overlay.children).flatMap(region => Array.from(region.children));
const checkHighlights = () => {
    assert.equal(lines().length, 2);
    for (const line of lines()) {
        assert.equal(line.children[0].style.color, "rgb(47, 157, 79)");
    }
};

render();
checkHighlights();
assert.equal(badge.textContent, "i+0");
assert.equal(overlay.children.length, 1);
assert.deepEqual(lines().map((line) => line.textContent), cues.map((cue) => cue.text));
lines()[1].click();
assert.equal(primary, 1);
checkHighlights();
assert.equal(badge.textContent, "i+1");

hiddenLevel = "i+1";
render();
assert.equal(lines().length, 1);
assert.equal(lines()[0].textContent, cues[0].text);
hiddenLevel = null;
render({ highlighter: { ...highlighter, enabled: false } });
assert.ok(lines().every((line) => line.children.length === 0));

render({ cues: [cues[0], { ...cues[1], alignment: 8 }] });
assert.equal(overlay.children.length, 2);
assert.match(overlay.children[1].className, /region-top/);
render({ cues: [{ ...cues[0], positionX: 192, positionY: 144 }] });
assert.equal(overlay.children[0].style.left, "50%");
assert.equal(overlay.children[0].style.transform, "translate(-50%, -100%)");
render({ cues: [] });
assert.equal(overlay.children.length, 0);
assert.equal(badge.textContent, "");
console.log("Subtitle overlay tests passed");

dom.window.close();
