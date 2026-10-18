import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const { bindManualCardUpdate, updateManualCardButton } = await import("../dist/esm/player/manual-card-update.js");
const settings = await import("../dist/esm/player/settings.js");
const button = document.getElementById("updateLastCardBtn");
const enabled = document.getElementById("manualCardUpdateEnabled");
const updates = [], messages = [], queries = [];
let ids = [12, 89, 33];
bindManualCardUpdate({
    buildSnapshot: () => ({ ankiUrl: "anki", deckName: 'My "Deck"' }),
    updateNote: async (id, snapshot) => updates.push([id, snapshot])
}, key => key, (...args) => messages.push(args), async (...args) => {
    queries.push(args);
    return ids;
});
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
button.click();
button.click();
await settle();
assert.equal(updates.length, 1);
assert.equal(updates[0][0], 89);
assert.equal(queries[0][1], 'deck:"My \\"Deck\\""');
assert.equal(button.disabled, false);
ids = [];
button.click();
await settle();
assert.equal(updates.length, 1);
assert.deepEqual(messages.at(-1), ["manualCardDeckEmpty", "error"]);
enabled.checked = false;
enabled.dispatchEvent(new Event("change"));
assert.equal(button.hidden, true);
settings.saveSettingsLocal({ silent: true });
enabled.checked = true;
settings.loadSettings();
assert.equal(enabled.checked, false);
assert.equal(button.hidden, true);
localStorage.setItem("subtitlePlayerSettings", "{}");
settings.loadSettings();
assert.equal(enabled.checked, true);
updateManualCardButton();
assert.equal(button.hidden, false);
clearTimeout(settings.settingsAutosaveTimerState.value);
dom.window.close();
console.log("Manual card update: latest note, duplicate clicks, empty deck, visibility, and persistence passed");
