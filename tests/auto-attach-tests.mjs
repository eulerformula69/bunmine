import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

let browserLock = false;
const locks = { async request(_name, _options, action) {
    if (browserLock) return action(null);
    browserLock = true;
    try { return await action({}); } finally { browserLock = false; }
} };
function makeContext() {
    const context = vm.createContext({ console, navigator: { locks }, t: (key) => key, setTimeout, clearTimeout });
    for (const name of ["anki-acquire-lock", "candidate-model", "auto-attach-controller"]) {
        vm.runInContext(fs.readFileSync(`dist/js/player/${name}.js`, "utf8"), context);
    }
    return context;
}
const context = makeContext();
function harness(overrides = {}) {
    const events = [];
    let calls = 0;
    let time = 0;
    const controller = context.createAutoAttachController({
        enabled: () => true,
        snapshot: (index) => ({ currentIdx: index, targetTime: 12, combinedText: "saved" }),
        noteIds: async () => ++calls === 1 ? [1] : [1, 2],
        verify: async (id) => events.push(["verify", id]),
        update: async (id, snapshot) => events.push(["update", id, snapshot]),
        exclusive: context.runExclusiveAnkiAcquire,
        sleep: async () => { time += 1000; },
        now: () => time,
        status: (key) => events.push([key]),
        done: () => events.push(["done"]),
        error: (error) => events.push(["error", error.message]),
        ...overrides,
    });
    return { controller, events };
}
{
    const { controller, events } = harness();
    await controller.start("word", 3);
    const update = events.find(([name]) => name === "update");
    assert.equal(update[1], 2);
    assert.equal(update[2].selectedWord, "word");
    assert.equal(update[2].targetTime, 12);
    assert.equal(update[2].currentIdx, 3);
    assert.ok(events.some(([name]) => name === "toastAutoAttachDone"));
    assert.equal(controller.isBusy(), false);
}
{
    const { controller, events } = harness({ enabled: () => false });
    await controller.start("word", 0);
    assert.equal(events.length, 0);
}
{
    let reads = 0;
    const { controller, events } = harness({ noteIds: async () => ++reads === 1 ? [1] : [1, 2, 3] });
    await controller.start("word", 0);
    assert.ok(events.some(([name]) => name === "error"));
    assert.ok(!events.some(([name]) => name === "update"));
}
{
    const { controller, events } = harness({ verify: async () => { throw new Error("wrong word"); } });
    await controller.start("word", 0);
    assert.ok(!events.some(([name]) => name === "update"));
}
{
    let finish;
    const { controller, events } = harness({ noteIds: () => new Promise((resolve) => { finish = resolve; }) });
    const work = controller.start("word", 0);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(controller.isBusy(), true);
    await assert.rejects(context.runExclusiveAnkiAcquire(async () => {}));
    const otherTab = makeContext();
    await assert.rejects(otherTab.runExclusiveAnkiAcquire(async () => {}));
    controller.cancel();
    finish([1]);
    await work;
    assert.ok(!events.some(([name]) => name === "update"));
    await otherTab.runExclusiveAnkiAcquire(async () => {});
}
{
    const { controller, events } = harness({ noteIds: async () => [1] });
    await controller.start("word", 0);
    assert.ok(events.some(([name, message]) => name === "error" && message === "toastAutoAttachNoNewCard"));
}
console.log("Automatic Anki attachment, cancellation, and shared lock tests passed");
