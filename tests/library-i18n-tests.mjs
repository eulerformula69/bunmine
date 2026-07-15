import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/library/library-i18n.js", "utf8");
const storage = new Map();
const context = vm.createContext({
    localStorage: {
        getItem: (key) => storage.get(key) ?? null,
    },
});
vm.runInContext(`${source}\nglobalThis.libraryI18nTestApi = { lt, loadLibraryLanguage };`, context);
const api = context.libraryI18nTestApi;

assert.equal(api.loadLibraryLanguage(), "en");
assert.equal(api.lt("episodeLabel", { number: 12 }), "Episode 12");
assert.equal(api.lt("missingTranslationKey"), "missingTranslationKey");

storage.set("subtitlePlayerSettings", JSON.stringify({ language: "ru" }));
assert.equal(api.loadLibraryLanguage(), "ru");
storage.set("subtitlePlayerSettings", "broken json");
assert.equal(api.loadLibraryLanguage(), "en");

console.log("Library i18n tests passed");
