import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";

const dom = installDom();
const element = id => document.getElementById(id);
const settings = await import("../dist/esm/player/settings.js");
const comprehension = await import("../dist/esm/subtitles/comprehension-level.js");

settings.initSettingsAutosave();

assert.equal(element("subtitlesVisible").checked, true);
assert.equal(element("subtitleAnnotationsVisible").checked, true);
assert.equal(element("subtitleComprehensionMinimum").value, "i+1");
assert.equal(document.querySelector('[data-subtitle-visible="true"]').getAttribute("aria-pressed"), "true");
assert.equal(document.querySelector('[data-comprehension-minimum="i+1"]').getAttribute("aria-pressed"), "true");
assert.equal(comprehension.shouldShowSubtitleForComprehensionLevel("i+0"), false);
assert.equal(comprehension.shouldShowSubtitleForComprehensionLevel("i+1"), true);

document.querySelector('[data-subtitle-visible="false"]').click();
assert.equal(element("subtitlesVisible").checked, false);
assert.equal(document.body.classList.contains("subtitles-hidden"), true);

document.querySelector('[data-comprehension-minimum="i+3"]').click();
assert.equal(element("subtitleComprehensionMinimum").value, "i+3");
assert.equal(comprehension.shouldShowSubtitleForComprehensionLevel("i+2"), false);
assert.equal(comprehension.shouldShowSubtitleForComprehensionLevel("i+3"), true);

element("subtitleAnnotationsVisible").checked = false;
element("subtitleAnnotationsVisible").dispatchEvent(new Event("change"));

await new Promise(resolve => setTimeout(resolve, 300));
const saved = JSON.parse(localStorage.getItem("subtitlePlayerSettings"));
assert.equal(saved.subtitlesVisible, false);
assert.equal(saved.subtitleAnnotationsVisible, false);
assert.equal(saved.subtitleComprehensionMinimum, "i+3");
assert.equal("showComprehensionI0" in saved, false);

localStorage.setItem("subtitlePlayerSettings", JSON.stringify({
    showComprehensionI0: false,
    showComprehensionI1: false,
    showComprehensionI2: true,
    showComprehensionI3: true,
    showComprehensionI4: true,
    showComprehensionI5Plus: true
}));
settings.loadSettings();
assert.equal(element("subtitlesVisible").checked, true);
assert.equal(element("subtitleAnnotationsVisible").checked, true);
assert.equal(element("subtitleComprehensionMinimum").value, "i+2");

localStorage.setItem("subtitlePlayerSettings", JSON.stringify({
    showComprehensionI0: false,
    showComprehensionI1: false,
    showComprehensionI2: false,
    showComprehensionI3: false,
    showComprehensionI4: false,
    showComprehensionI5Plus: false
}));
settings.loadSettings();
assert.equal(element("subtitlesVisible").checked, false);
assert.equal(document.body.classList.contains("subtitles-hidden"), true);

console.log("Subtitle visibility, threshold, persistence, and migration tests passed");

clearTimeout(settings.settingsAutosaveTimerState.value);
dom.window.close();
