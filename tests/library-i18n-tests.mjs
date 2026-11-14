import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom("library");
const api = await import("../dist/esm/library/library-i18n.js");
const {initializeMachineSettings} = await import("../dist/esm/core/machine-settings.js");

async function setLanguage(language) {
    globalThis.fetch = async () => new Response(JSON.stringify({settings: {language}}));
    await initializeMachineSettings();
}

assert.equal(api.loadLibraryLanguage(), "en");
assert.equal(api.lt("episodeLabel", { number: 12 }), "Episode 12");
assert.equal(api.lt("missingTranslationKey"), "missingTranslationKey");

await setLanguage('ru');
assert.equal(api.loadLibraryLanguage(), "ru");
await setLanguage('unsupported');
assert.equal(api.loadLibraryLanguage(), "en");
for (const [language, label] of [['en', 'Not an episode'], ['ru', 'Не серия'], ['ja', '本編ではない']]) {
    await setLanguage(language);
    api.libraryCurrentLangState.value = api.loadLibraryLanguage();
    assert.equal(api.lt('notAnEpisode'), label);
}

const locales = await Promise.all(["en", "ru", "ja"].map(async (language) => {
    const { default: locale } = await import(`../dist/esm/core/locales/${language}.js`);
    return Object.keys(locale.dict).sort();
}));
assert.deepEqual(locales[1], locales[0], "Russian translation keys must match English");
assert.deepEqual(locales[2], locales[0], "Japanese translation keys must match English");

console.log("Library i18n tests passed");

dom.window.close();
