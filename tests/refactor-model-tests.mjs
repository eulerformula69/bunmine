import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const { retryAfterToMs } = await import("../dist/esm/core/rate-limit.js");
const { requestSubtitleWithRetry: retryOnRateLimit } = await import("../dist/esm/library/library-subtitle-request.js");
assert.equal(retryAfterToMs("2"), 2000);
assert.equal(retryAfterToMs("invalid"), 12000);
assert.equal(retryAfterToMs("Thu, 01 Oct 2026 00:00:02 GMT", 12000, Date.parse("2026-10-01T00:00:00Z")), 2000);
let requests = 0;
const waits = [];
const data = await retryOnRateLimit(async () => ({
    response: new Response("", { status: ++requests < 3 ? 429 : 200 }), data: {retryAfter: 2, result: "done"}
}), {failureMessage: "failed", exhaustedMessage: "limit", onWait: ms => waits.push(ms), wait: async () => {}});
assert.equal(data.result, "done");
assert.deepEqual(waits, [2000, 2000]);
await assert.rejects(retryOnRateLimit(async () => ({response: new Response("", {status:429}), data:{}}), {
    failureMessage: "failed", exhaustedMessage: "limit", retries: 0, onWait() {}, wait: async () => {}
}), /limit/);
const {buildSentenceFurigana} = await import("../dist/esm/anki/furigana.js");
assert.equal(await buildSentenceFurigana("猫を見る", async () => [
    {surface_form: "猫", reading:"ネコ", word_position:1},
    {surface_form: "を", reading:"ヲ", word_position:2},
    {surface_form: "見る", reading:"ミル", word_position:3}
]), "猫[ねこ]を&nbsp;見[み]る");
const {t} = await import("../dist/esm/core/translate.js");
assert.equal(t("candidateTitle", {}, "ja"), "候補");
assert.equal(t("unknown-key", {}, "invalid"), "unknown-key");
const {createTimeupdateLoop} = await import("../dist/esm/player/timeupdate-loop.js");
const {video, progress} = await import("../dist/esm/core/dom.js");
Object.defineProperty(video,"duration",{value:100});
video.currentTime=25;
let rendered=0;
createTimeupdateLoop({getCurrentSubtitle:()=>null,render:()=>{rendered++;}})();
assert.equal(progress.value,"25");
assert.equal(rendered,1);
console.log("Shared retry, translation, furigana and playback loop tests passed");
dom.window.close();
