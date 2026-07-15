import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("dist/js/library/library-presentation.js", "utf8")
    .replace("const LibraryPresentation =", "globalThis.LibraryPresentation =");
const context = vm.createContext({});
vm.runInContext(source, context);
const presentation = context.LibraryPresentation;
const translate = (key) => key;

assert.equal(presentation.formatTime(0), "0m");
assert.equal(presentation.formatTime(3720), "1h 2m");
assert.equal(presentation.formatBytes(1536), "2 KB");
assert.equal(presentation.escapeHtml('<a title="x">&'), "&lt;a title=&quot;x&quot;&gt;&amp;");
assert.equal(presentation.linkStatus([]), "missing");
assert.equal(presentation.linkStatus([{ hasVideo: true, hasSubtitle: false }]), "partial");
assert.equal(presentation.linkStatus([{ hasVideo: true, hasSubtitle: true }]), "linked");
assert.equal(presentation.statusLabel("partial", translate), "partiallyLinked");
assert.equal(presentation.planStatusLabel("needs-review", translate), "needsReview");

console.log("Library presentation tests passed");
