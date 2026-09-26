import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, {
        value: "", checked: true, style: {}, dataset: {}, attributes: {}, handlers: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(name, callback) {
            const previous = this.handlers[name];
            this.handlers[name] = () => { previous?.(); callback(); };
        },
        appendChild() {}, dispatchEvent() {},
    });
    return elements.get(id);
}
const storage = new Map();
let autosave;
const context = vm.createContext({
    console, currentLang: "en", globalSubDelay: 0,
    document: {
        getElementById: element, querySelectorAll: () => [], querySelector: () => null,
        createElement: () => ({})
    },
    window: { addEventListener() {} },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: (callback) => { autosave = callback; return 1; }, clearTimeout() {},
});
for (const file of ["core/i18n", "player/settings"]) {
    vm.runInContext(fs.readFileSync(`dist/js/${file}.js`, "utf8"), context);
}
const button = element("imageSubtitleMode");
context.initSettingsAutosave();
assert.equal(button.textContent, "All text");
button.handlers.click();
assert.equal(button.value, "timed");
assert.equal(button.attributes["aria-pressed"], "true");
autosave();
assert.equal(JSON.parse(storage.get("subtitlePlayerSettings")).imageSubtitleMode, "timed");
context.applyLanguage("ru");
assert.equal(button.textContent, "По времени");
storage.set("subtitlePlayerSettings", JSON.stringify({ imageSubtitleMode: "timed", includeImageSubtitle: false }));
button.value = "all";
context.loadSettings();
assert.equal(button.value, "timed");
assert.equal(button.disabled, true);
element("includeImageSubtitle").checked = true;
element("includeImageSubtitle").handlers.change();
assert.equal(button.disabled, false);
storage.set("subtitlePlayerSettings", "{}");
context.loadSettings();
assert.equal(button.value, "all");
assert.equal(button.textContent, "Весь текст");
button.handlers.click();
button.handlers.click();
assert.equal(button.value, "all");
console.log("Image subtitle mode toggle, persistence, migration, and translation tests passed");
