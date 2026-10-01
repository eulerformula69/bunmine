import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom("library");
const api = await import("../dist/esm/library/library-i18n.js");

assert.equal(api.loadLibraryLanguage(), "en");
assert.equal(api.lt("episodeLabel", { number: 12 }), "Episode 12");
assert.equal(api.lt("missingTranslationKey"), "missingTranslationKey");

localStorage.setItem("subtitlePlayerSettings", JSON.stringify({ language: "ru" }));
assert.equal(api.loadLibraryLanguage(), "ru");
localStorage.setItem("subtitlePlayerSettings", "broken json");
assert.equal(api.loadLibraryLanguage(), "en");

console.log("Library i18n tests passed");

dom.window.close();
