import assert from "node:assert/strict";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();
const context = {
    ...await import("../dist/esm/player/candidate-model.js"),
    ...await import("../dist/esm/player/capture-controller.js"),
    ...await import("../dist/esm/player/review-controller.js"),
};
const snapshot = { selectedWord: "猫", combinedText: "猫です", audioStart: 10, audioEnd: 15 };
let saved;
let saves = 0;
const capture = context.createCandidateCaptureController({
    buildSnapshot: () => ({ ...snapshot }),
    save: async (value) => { saves++; saved = value; },
    saved: async () => {},
});
await capture(" 犬 ", 2);
assert.equal(saved.selectedWord, "犬");
assert.equal(saved.combinedText, "猫です");
await assert.rejects(capture("", 2));
await assert.rejects(capture("猫", -1));
assert.equal(saves, 1);
assert.equal(context.findCandidateNote([1], [1, 2]), 2);
assert.throws(() => context.findCandidateNote([1], [1, 2, 3]));
assert.equal(context.candidateCaptureHotkey({ code: "KeyQ", altKey: true }), true);
assert.equal(context.candidateCaptureHotkey({ code: "KeyQ", altKey: true, repeat: true }), false);

function harness(overrides = {}) {
    const events = [];
    let count = 0;
    let now = 0;
    const review = context.createCandidateReviewController({
        action: async (_id, action, _token, note) => {
            events.push([action, note]);
            return { token: "lease" };
        },
        noteIds: async () => ++count === 1 ? [1] : [1, 2],
        copy: async (word) => events.push(["copy", word]),
        verify: async () => {},
        update: async (id, value) => events.push(["update", id, value]),
        sleep: async () => { now += 1000; },
        now: () => now,
        changed: async () => events.push(["changed"]),
        status: () => {},
        ...overrides,
    });
    return { review, events };
}
const candidate = () => ({ id: 1, snapshot: { ...snapshot }, anki_note_id: null });
{
    const { review, events } = harness();
    await review.acquireCandidate(candidate());
    assert.deepEqual(events.filter(([name]) => ["copy", "bind", "accept"].includes(name)),
        [["copy", "猫"], ["bind", 2], ["accept", undefined]]);
    assert.equal(events.find(([name]) => name === "update")[2].audioStart, 10);
    assert.equal(review.isBusy(), false);
}
{
    const { review, events } = harness({ noteIds: async () => [5, 7] });
    await review.attachLatestCandidate(candidate());
    assert.deepEqual(events.filter(([name]) => ["bind", "update", "accept"].includes(name)).map(([name, value]) => [name, value]),
        [["bind", 7], ["update", 7], ["accept", undefined]]);
    assert.equal(events.some(([name]) => name === "copy"), false);
}
{
    const { review } = harness({ noteIds: async () => [] });
    await assert.rejects(review.attachLatestCandidate(candidate()));
}
{
    let release;
    const { review, events } = harness({ copy: () => new Promise((resolve) => { release = resolve; }) });
    const work = review.acquireCandidate(candidate());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(review.isBusy(), true);
    await review.acquireCandidate(candidate());
    await review.reject(candidate());
    assert.equal(events.filter(([name]) => name === "claim").length, 1);
    assert.equal(events.some(([name]) => name === "reject"), false);
    release();
    await work;
}
{
    let calls = 0;
    const { review, events } = harness({ noteIds: async () => ++calls === 1 ? [1] : [1, 2, 3] });
    await assert.rejects(review.acquireCandidate(candidate()));
    assert.equal(events.some(([name]) => name === "update" || name === "bind"), false);
    assert.equal(events.some(([name]) => name === "release"), true);
}
{
    let waiting = false;
    const { review, events } = harness({
        noteIds: async () => [1],
        sleep: async () => { waiting = true; return new Promise(() => {}); },
    });
    const work = review.acquireCandidate(candidate());
    for (let attempt = 0; attempt < 10 && !waiting; attempt++) {
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(waiting, true);
    assert.equal(review.isBusy(), true);
    review.cancelAcquire();
    await work;
    assert.equal(review.isBusy(), false);
    assert.equal(events.some(([name]) => name === "release"), true);
    assert.equal(events.some(([name]) => name === "bind" || name === "update" || name === "accept"), false);
}
{
    const { review, events } = harness({ noteIds: async () => [1] });
    await assert.rejects(review.acquireCandidate(candidate()));
    assert.equal(events.some(([name]) => name === "accept"), false);
}
{
    const value = candidate();
    const { review } = harness({ update: async () => { throw new Error("export failed"); } });
    await assert.rejects(review.acquireCandidate(value));
    assert.equal(value.anki_note_id, 2);
    const retry = harness();
    await retry.review.acquireCandidate(value);
    assert.equal(retry.events.some(([name]) => name === "copy"), false);
    assert.equal(retry.events.some(([name]) => name === "accept"), true);
}
{
    const { review, events } = harness({ verify: async () => { throw new Error("wrong word"); } });
    await assert.rejects(review.acquireCandidate(candidate()));
    assert.equal(events.some(([name]) => name === "bind" || name === "update"), false);
}
{
    const { review, events } = harness();
    await review.reject(candidate());
    assert.equal(events[0][0], "reject");
}
console.log("Candidate controller tests passed");

dom.window.close();
