import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const page = process.argv[2] || "player";
const dom = installDom(page);
const calls = [];
const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args);
globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    const action = options?.body ? JSON.parse(options.body).action : undefined;
    return new Response(JSON.stringify(action ? {result: [], error:null} : {series:[],videos:[],candidates:[],words:[]}));
};
if (page === "player") {
    const tokenizer = await import("../dist/esm/japanese/japanese-tokenizer.js");
    tokenizer.japaneseTokenizerPromiseState.value = Promise.resolve({tokenize:()=>[]});
    await import("../dist/esm/bootstrap.js");
    await new Promise(resolve=>setTimeout(resolve,100));
    assert.ok(calls.some(url=>url.endsWith('/videos')), "Player startup must restore the video list");
    const settings = await import("../dist/esm/player/settings.js");
    clearTimeout(settings.settingsAutosaveTimerState.value);
} else {
    await import("../dist/esm/library-bootstrap.js");
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.ok(calls.some(url=>url.endsWith('/library/series')));
}
dom.window.close();
console.error = originalError;
assert.deepEqual(errors, [], "Page startup must not report errors");
console.log(`${page} module startup passed`);
