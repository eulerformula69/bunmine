import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";

installDom();
document.body.innerHTML = '<button id="action" type="button">Action</button>';

const { bindSelectionButtonAction } = await import("../dist/esm/player/selection-button.js");
const button = document.getElementById("action");
let calls = 0;

bindSelectionButtonAction(button, () => {
    calls += 1;
});

button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
assert.equal(calls, 1, "A pointer click must run the action once");

button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
assert.equal(calls, 2, "A keyboard click must run the action");

button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 2 }));
assert.equal(calls, 2, "A secondary pointer button must not run the action");

console.log("Selection button activation tests passed");
