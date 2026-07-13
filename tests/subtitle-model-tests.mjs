import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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

const context = {
    console,
    Event,
    EventTarget,
    ReadableStream,
    video: { currentTime: 5 },
    globalSubDelay: 0,
    lastClickedSubtitleIdx: null,
    subtitles: []
};
context.window = context;
context.window.VTTCue = TestVTTCue;
vm.createContext(context);

for (const file of [
    "dist/js/subtitles/model.js",
    "dist/js/subtitles/parser-types.js",
    "dist/js/subtitles/format-detection.js",
    "dist/js/subtitles/normalization.js",
    "dist/js/subtitles/parsing.js",
    "dist/js/subtitles/parsers/legacy-parser.js",
    "dist/js/subtitles/parsers/external-parser.js",
    "frontend/libs/media-captions/media-captions.js",
    "dist/js/subtitles/parsers/media-captions-ass-metadata.js",
    "dist/js/subtitles/parsers/media-captions-parser.js",
    "dist/js/subtitles/parser-registry.js",
    "dist/js/subtitles/parse-subtitle-source.js",
    "dist/js/subtitles/timing.js",
    "dist/js/subtitles/navigation.js"
]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const evaluate = (source) => vm.runInContext(source, context);

assert.equal(evaluate('detectSubtitleFormat({ filename: "episode.srt" })'), "srt");
assert.equal(evaluate('detectSubtitleFormat({ filename: "episode.VTT" })'), "vtt");
assert.equal(evaluate('detectSubtitleFormat({ filename: "episode.ass" })'), "ass");
assert.equal(evaluate('detectSubtitleFormat({ filename: "episode.ssa" })'), "ssa");
assert.equal(evaluate('detectSubtitleFormat({ source: "ordinary text" })'), "unknown");
assert.equal(evaluate('subtitleParserRegistry.resolve("srt").id'), "media-captions");

const srt = `1\r
00:00:01,000 --> 00:00:02,000\r
日本語\r
二行目\r
\r
2\r
00:00:01,000 --> 00:00:02,000\r
overlap`;
context.srt = srt;
const srtResult = await evaluate('parseSubtitleSource({ source: srt, format: "srt" })');
assert.equal(srtResult.cues.length, 2, "overlapping cues with identical timecodes must be preserved");
assert.equal(srtResult.cues[0].startTime, 1);
assert.equal(srtResult.cues[0].endTime, 2);
assert.equal(srtResult.cues[0].text, "日本語\n二行目", "CRLF must normalize without losing Japanese text");
assert.equal(srtResult.cues[0].id, (await evaluate('parseSubtitleSource({ source: srt, format: "srt" })')).cues[0].id);

const legacySrt = evaluate("parseSRT(srt)");
assert.equal(legacySrt[0].start, srtResult.cues[0].startTime, "legacy SRT timing must remain compatible");
assert.equal(legacySrt[0].text, srtResult.cues[0].text);

context.invalidDrafts = [
    { startTime: Number.NaN, endTime: 2, text: "NaN" },
    { startTime: Number.POSITIVE_INFINITY, endTime: 2, text: "Infinity" },
    { startTime: -2, endTime: -1, text: "negative" }
];
const normalized = evaluate('normalizeSubtitleCues(invalidDrafts, "srt")');
assert.equal(normalized.cues.length, 1);
assert.equal(normalized.warnings.length, 2);
assert.equal(normalized.cues[0].startTime, 0);
assert.equal(normalized.cues[0].endTime, 0);

const ass = `[Script Info]
PlayResX: 1920
PlayResY: 1080
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment
Style: Dialogue,Arial,40,&HFFFFFF,&HFFFFFF,&H0,&H0,0,0,0,0,100,100,0,0,1,2,0,2
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 1,0:00:01.00,0:00:08.00,Dialogue,,0,0,0,,{\\an8\\pos(960,100)}看板
Dialogue: 0,0:00:04.00,0:00:06.00,Dialogue,,0,0,0,,会話`;
context.ass = ass;
const assResult = await evaluate('parseSubtitleSource({ source: ass, format: "ass" })');
assert.equal(assResult.cues.length, 2);
assert.equal(assResult.cues[0].alignment, 8);
assert.equal(assResult.cues[0].positionX, 960);
assert.equal(assResult.cues[0].positionY, 100);
assert.equal(assResult.cues[0].playResX, 1920);
assert.equal(assResult.cues[0].fontName, "Arial");
assert.equal(assResult.cues[0].primaryColor, "#FFFFFF");

context.subtitles = evaluate("toRuntimeSubtitleCues")(assResult.cues);
assert.equal(evaluate("getPrimarySubtitleIndex()"), 1, "bottom dialogue should beat a positioned sign");
context.lastClickedSubtitleIdx = 0;
assert.equal(evaluate("getPrimarySubtitleIndex()"), 0, "an explicit active selection should win");

await evaluate(`(async () => {
    const external = new ExternalSubtitleParser("fake-external", ["vtt"], async () => [{
        startTime: 2,
        endTime: 4,
        text: "external",
        attributes: { region: "speaker" }
    }]);
    subtitleParserRegistry.register(external);
})()`);
assert.equal(evaluate('subtitleParserRegistry.resolve("vtt").id'), "fake-external");
const externalResult = await evaluate('parseSubtitleSource({ source: "WEBVTT", format: "vtt" })');
assert.equal(externalResult.cues[0].startTime, 2);
assert.equal(externalResult.cues[0].metadata.region, "speaker");
evaluate('subtitleParserRegistry.unregister("fake-external")');

await assert.rejects(
    evaluate('parseSubtitleSource({ source: "plain text", format: "unknown" })'),
    (error) => error.code === "unsupported-format" && error.format === "unknown"
);

await evaluate(`(async () => {
    subtitleParserRegistry.register(new ExternalSubtitleParser("broken", ["vtt"], async () => {
        throw new Error("third-party details");
    }));
})()`);
await assert.rejects(
    evaluate('parseSubtitleSource({ source: "WEBVTT", format: "vtt" })'),
    (error) => error.code === "provider-failed" && error.cause?.message === "third-party details"
);
evaluate('subtitleParserRegistry.unregister("broken")');

context.grouped = [
    { start: 1, end: 2, text: "one" },
    { start: 3, end: 5, text: "two-a" },
    { start: 3.01, end: 4, text: "two-b" },
    { start: 7, end: 8, text: "three" }
];
assert.equal(evaluate("findSubtitleIndexForOffset(grouped, 3, 1)"), 3);
assert.equal(evaluate("findSubtitleIndexForOffset(grouped, 3, -1)"), 0);

console.log("Subtitle parser infrastructure tests passed");
