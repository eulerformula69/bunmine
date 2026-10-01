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

const locales = await Promise.all(["en", "ru", "ja"].map(async (language) => {
    const { default: locale } = await import(`../dist/esm/core/locales/${language}.js`);
    return Object.keys(locale.dict).sort();
}));
assert.deepEqual(locales[1], locales[0], "Russian translation keys must match English");
assert.deepEqual(locales[2], locales[0], "Japanese translation keys must match English");

console.log("Library i18n tests passed");

dom.window.close();
