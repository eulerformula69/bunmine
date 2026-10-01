import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();

const fixtureDir = path.resolve("tests/fixtures/subtitles");
const fixture = (name) => fs.readFileSync(path.join(fixtureDir, name), "utf8");
class TestVTTCue extends EventTarget {
    constructor(startTime, endTime, text) {
        super();
        this.id = "";
        this.startTime = startTime;
        this.endTime = endTime;
        this.text = text;
        this.pauseOnExit = false;
    }
}

const context = { console, Event, EventTarget, ReadableStream };
context.window = window;
context.window.VTTCue = TestVTTCue;
globalThis.VTTCue = TestVTTCue;
Object.defineProperty(globalThis, "EventTarget", { configurable: true, value: window.EventTarget });
const { ParseErrorCode, parseText } = await import("media-captions");
globalThis.MediaCaptions = { ParseErrorCode, parseText };

Object.assign(context,
    await import("../dist/esm/subtitles/model.js"),
    await import("../dist/esm/subtitles/parser-types.js"),
    await import("../dist/esm/subtitles/format-detection.js"),
    await import("../dist/esm/subtitles/normalization.js"),
    await import("../dist/esm/subtitles/parsing.js"),
    await import("../dist/esm/subtitles/parsers/legacy-parser.js"),
    await import("../dist/esm/subtitles/parsers/external-parser.js"),
    await import("../dist/esm/subtitles/parsers/media-captions-ass-metadata.js"),
    await import("../dist/esm/subtitles/parsers/media-captions-parser.js"),
    await import("../dist/esm/subtitles/parser-registry.js"),
    await import("../dist/esm/subtitles/parse-subtitle-source.js")
);


async function parseFixture(name, format) {
    context.fixtureSource = fixture(name);
    context.fixtureFormat = format;
    return (context.parseSubtitleSource({ source: context.fixtureSource, format: context.fixtureFormat }));
}

assert.deepEqual(
    Array.from((context.subtitleParserRegistry.resolveAll("srt").map((provider) => provider.id))),
    ["media-captions", "legacy"]
);

const basicSrt = await parseFixture("basic.srt", "srt");
assert.equal(basicSrt.cues.length, 2);
assert.equal(basicSrt.cues[0].id, "1");
assert.equal(basicSrt.cues[0].startTime, 1.25, "milliseconds must be converted to seconds");
assert.equal(basicSrt.cues[0].endTime, 2.5);
assert.equal(basicSrt.cues[0].text, "日本語の一行目");
assert.equal(basicSrt.cues[0].metadata.provider, "media-captions");

const htmlSrt = await parseFixture("html.srt", "srt");
assert.equal(htmlSrt.cues[0].text, "太字\n二行目");
assert.match(htmlSrt.cues[0].rawText, /<b>/);

const basicVtt = await parseFixture("basic.vtt", "vtt");
assert.equal(basicVtt.cues.length, 2);
assert.equal(basicVtt.cues[0].id, "intro-cue");
assert.equal(basicVtt.cues[0].text, "日本語");

const settingsVtt = await parseFixture("settings.vtt", "vtt");
assert.equal(settingsVtt.cues[0].id, "positioned-cue");
assert.equal(settingsVtt.cues[0].text, "設定付き字幕");
assert.equal(settingsVtt.cues[0].metadata.settings.line, 10);
assert.equal(settingsVtt.cues[0].metadata.settings.position, 20);
assert.equal(settingsVtt.cues[0].metadata.settings.size, 70);
assert.equal(settingsVtt.cues[0].metadata.settings.align, "start");

const ass = await parseFixture("styled.ass", "ass");
assert.equal(ass.cues.length, 2);
assert.equal(ass.cues[0].text, "日本語\n二行目");
assert.match(ass.cues[0].rawText, /\\N/);
assert.equal(ass.cues[0].alignment, 8);
assert.equal(ass.cues[0].positionX, 960);
assert.equal(ass.cues[0].positionY, 100);
assert.equal(ass.cues[0].playResX, 1920);
assert.equal(ass.cues[0].playResY, 1080);
assert.equal(ass.cues[0].fontName, "Arial");
assert.equal(ass.cues[0].fontSize, 40);
assert.equal(ass.cues[0].primaryColor, "#FFFFFF");
assert.equal(ass.cues[0].bold, true);
assert.equal(ass.cues[0].italic, true);
assert.equal(ass.cues[0].layer, 2);
assert.equal(ass.cues[0].style, "TopDialogue");
assert.ok(ass.cues[0].startTime <= ass.cues[1].startTime, "provider cue order must be preserved");

const drawingModes = await parseFixture("drawing-modes.ass", "ass");
assert.equal(drawingModes.cues.length, 2, "pure vector drawing events must not become subtitle text");
assert.deepEqual(
    Array.from(drawingModes.cues, (cue) => cue.text),
    ["普通のテキスト", "普通のテキスト"],
    "text after \\p0 and ordinary text must be preserved"
);
assert.deepEqual(
    Array.from(drawingModes.cues, (cue) => cue.startTime),
    [5, 7],
    "only the pure \\p1 and \\p4 drawing events should be filtered"
);

const malformedClipReal = await parseFixture("malformed-clip-real.ass", "ass");
assert.equal(malformedClipReal.cues.length, 1);
assert.equal(malformedClipReal.cues[0].text, "即使雨过天晴");
assert.doesNotMatch(malformedClipReal.cues[0].text, /\\clip/i);
assert.doesNotMatch(malformedClipReal.cues[0].text, /m 964/i);
assert.doesNotMatch(malformedClipReal.cues[0].text, /b 945\.6/i);
assert.equal(malformedClipReal.cues[0].positionX, 960);
assert.equal(malformedClipReal.cues[0].positionY, 12);
assert.match(malformedClipReal.cues[0].rawText, /^\{3\\pos/);

const malformedOverridePrefixes = await parseFixture("malformed-override-prefix.ass", "ass");
assert.equal(malformedOverridePrefixes.cues.length, 5);
assert.deepEqual(
    Array.from(malformedOverridePrefixes.cues, (cue) => cue.text),
    ["字幕", "字幕", "字幕", "字幕", "普通のテキスト 123"]
);
assert.deepEqual(
    Array.from(malformedOverridePrefixes.cues.slice(0, 3), (cue) => [cue.positionX, cue.positionY]),
    [[960, 12], [100, 200], [100, 200]]
);
assert.match(malformedOverridePrefixes.cues[0].rawText, /^\{2\\pos/);

context.malformedOverrideSource = "{2\\pos(960,12)\\fad(0,300)\\clip(m 1 2 l 3 4)\\an8\\fs40}字幕";
assert.equal(
    (context.normalizeMediaCaptionsAssSource(context.malformedOverrideSource)),
    "{\\pos(960,12)\\fad(0,300)\\clip(m 1 2 l 3 4)\\an8\\fs40}字幕",
    "normalization must remove only the numeric prefix before the first ASS tag"
);
context.ordinaryAssText = "普通のテキスト 123";
assert.equal((context.normalizeMediaCaptionsAssSource(context.ordinaryAssText)), context.ordinaryAssText);

const ssa = await parseFixture("basic.ssa", "ssa");
assert.equal(ssa.cues.length, 1);
assert.equal(ssa.cues[0].text, "SSA 日本語");
assert.equal(ssa.cues[0].fontName, "MS Gothic");
assert.equal(ssa.cues[0].playResX, 640);

const overlapping = await parseFixture("overlap.srt", "srt");
assert.equal(overlapping.cues.length, 3);
assert.equal(overlapping.cues[0].startTime, overlapping.cues[1].startTime);
assert.equal(overlapping.cues[0].endTime, overlapping.cues[1].endTime);
assert.deepEqual(Array.from(overlapping.cues, (cue) => cue.text), ["first", "second", "third"]);

const empty = await parseFixture("empty.srt", "srt");
assert.equal(empty.cues.length, 0);
assert.equal(empty.warnings.length, 0);

const malformed = await parseFixture("malformed.srt", "srt");
assert.equal(malformed.cues.length, 0);
assert.ok(malformed.warnings.some((warning) => warning.code === "provider-fallback"));

const stableFirst = await parseFixture("styled.ass", "ass");
const stableSecond = await parseFixture("styled.ass", "ass");
assert.equal(stableFirst.cues[0].id, stableSecond.cues[0].id);

for (const [name, format] of [["basic.srt", "srt"], ["basic.vtt", "vtt"]]) {
    context.fixtureSource = fixture(name);
    context.fixtureFormat = format;
    const external = await (new context.MediaCaptionsSubtitleParser().parse({ source: context.fixtureSource, format: context.fixtureFormat }));
    const legacy = await (new context.LegacySubtitleParser().parse({ source: context.fixtureSource, format: context.fixtureFormat }));
    assert.equal(external.cues.length, legacy.cues.length, `${name}: cue count`);
    assert.deepEqual(
        Array.from(external.cues, (cue) => [cue.startTime, cue.endTime, cue.text]),
        Array.from(legacy.cues, (cue) => [cue.startTime, cue.endTime, cue.text]),
        `${name}: timing, plain text, and order`
    );
}

const parserSourceFiles = fs.readdirSync("frontend/js/subtitles/parsers")
    .filter((name) => name.endsWith(".ts"));
const filesWithLibraryTypes = parserSourceFiles.filter((name) => {
    const source = fs.readFileSync(path.join("frontend/js/subtitles/parsers", name), "utf8");
    return /MediaCaptionsLibrary(?:Cue|Error|Result)/.test(source);
});
assert.deepEqual(filesWithLibraryTypes, ["media-captions-parser.ts"]);

console.log("Media captions provider fixture and regression tests passed");

dom.window.close();
