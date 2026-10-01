import assert from "node:assert/strict";

const context = await import("../dist/esm/player/runtime-prefetch.js");

const state = {
    runtimePrefetchAllRunId: 0,
    runtimePrefetchAllInProgress: false,
    runtimeHighlightPrefetchReady: false,
    runtimePrefetchWindowStart: -1,
    runtimePrefetchWindowEnd: -1,
    runtimeNextPrefetchStart: 0,
};
const requested = [];
let rerenders = 0;
const controller = context.createRuntimePrefetchController({
    state,
    getSubtitles: () => [{ text: "猫" }, { text: "犬" }],
    getCurrentSubtitle: () => ({ text: "missing reference" }),
    loadWordIndexes: async () => {},
    loadTokenizer: async () => {},
    collectCandidates: (text) => [text, "known"],
    hasStatus: (candidate) => candidate === "known",
    ensureStatuses: async (candidates) => requested.push(...candidates),
    rerender: () => { rerenders += 1; },
    delay: async () => {},
});

await controller.prefetch();
assert.deepEqual(requested, ["猫", "犬"]);
assert.equal(state.runtimePrefetchWindowStart, 0);
assert.equal(state.runtimePrefetchWindowEnd, 1);
assert.equal(state.runtimeNextPrefetchStart, 2);
assert.equal(state.runtimePrefetchAllInProgress, false);
assert.equal(state.runtimeHighlightPrefetchReady, true);
assert.equal(rerenders, 1);

console.log("Runtime prefetch tests passed");
