import assert from "node:assert/strict";
import fs from "node:fs";
import { installDom } from "./dom-environment.mjs";
const dom = installDom();

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
    await import("../dist/esm/subtitles/parse-subtitle-source.js"),
    await import("../dist/esm/subtitles/timing.js"),
    await import("../dist/esm/subtitles/navigation.js")
);


const { state } = await import("../dist/esm/core/state.js");
document.getElementById("video").currentTime = 5;

assert.equal((context.detectSubtitleFormat({ filename: "episode.srt" })), "srt");
assert.equal((context.detectSubtitleFormat({ filename: "episode.VTT" })), "vtt");
assert.equal((context.detectSubtitleFormat({ filename: "episode.ass" })), "ass");
assert.equal((context.detectSubtitleFormat({ filename: "episode.ssa" })), "ssa");
assert.equal((context.detectSubtitleFormat({ source: "ordinary text" })), "unknown");
assert.equal((context.subtitleParserRegistry.resolve("srt").id), "media-captions");

const srt = `1\r
00:00:01,000 --> 00:00:02,000\r
日本語\r
二行目\r
\r
2\r
00:00:01,000 --> 00:00:02,000\r
overlap`;
context.srt = srt;
const srtResult = await (context.parseSubtitleSource({ source: context.srt, format: "srt" }));
assert.equal(srtResult.cues.length, 2, "overlapping cues with identical timecodes must be preserved");
assert.equal(srtResult.cues[0].startTime, 1);
assert.equal(srtResult.cues[0].endTime, 2);
assert.equal(srtResult.cues[0].text, "日本語\n二行目", "CRLF must normalize without losing Japanese text");
assert.equal(srtResult.cues[0].id, (await (context.parseSubtitleSource({ source: context.srt, format: "srt" }))).cues[0].id);

const legacySrt = (context.parseSRT(context.srt));
assert.equal(legacySrt[0].start, srtResult.cues[0].startTime, "legacy SRT timing must remain compatible");
assert.equal(legacySrt[0].text, srtResult.cues[0].text);

context.invalidDrafts = [
    { startTime: Number.NaN, endTime: 2, text: "NaN" },
    { startTime: Number.POSITIVE_INFINITY, endTime: 2, text: "Infinity" },
    { startTime: -2, endTime: -1, text: "negative" }
];
const normalized = (context.normalizeSubtitleCues(context.invalidDrafts, "srt"));
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
const assResult = await (context.parseSubtitleSource({ source: context.ass, format: "ass" }));
assert.equal(assResult.cues.length, 2);
assert.equal(assResult.cues[0].alignment, 8);
assert.equal(assResult.cues[0].positionX, 960);
assert.equal(assResult.cues[0].positionY, 100);
assert.equal(assResult.cues[0].playResX, 1920);
assert.equal(assResult.cues[0].fontName, "Arial");
assert.equal(assResult.cues[0].primaryColor, "#FFFFFF");

state.subtitles = (context.toRuntimeSubtitleCues)(assResult.cues);
assert.equal((context.getPrimarySubtitleIndex()), 1, "bottom dialogue should beat a positioned sign");
state.lastClickedSubtitleIdx = 0;
assert.equal((context.getPrimarySubtitleIndex()), 0, "an explicit active selection should win");

await ((async () => {
    const external = new context.ExternalSubtitleParser("fake-external", ["vtt"], async () => [{
        startTime: 2,
        endTime: 4,
        text: "external",
        attributes: { region: "speaker" }
    }]);
    context.subtitleParserRegistry.register(external);
})());
assert.equal((context.subtitleParserRegistry.resolve("vtt").id), "fake-external");
const externalResult = await (context.parseSubtitleSource({ source: "WEBVTT", format: "vtt" }));
assert.equal(externalResult.cues[0].startTime, 2);
assert.equal(externalResult.cues[0].metadata.region, "speaker");
(context.subtitleParserRegistry.unregister("fake-external"));

await assert.rejects(
    (context.parseSubtitleSource({ source: "plain text", format: "unknown" })),
    (error) => error.code === "unsupported-format" && error.format === "unknown"
);

await ((async () => {
    context.subtitleParserRegistry.register(new context.ExternalSubtitleParser("broken", ["vtt"], async () => {
        throw new Error("third-party details");
    }));
})());
await assert.rejects(
    (context.parseSubtitleSource({ source: "WEBVTT", format: "vtt" })),
    (error) => error.code === "provider-failed" && error.cause?.message === "third-party details"
);
(context.subtitleParserRegistry.unregister("broken"));

context.grouped = [
    { start: 1, end: 2, text: "one" },
    { start: 3, end: 5, text: "two-a" },
    { start: 3.01, end: 4, text: "two-b" },
    { start: 7, end: 8, text: "three" }
];
assert.equal((context.findSubtitleIndexForOffset(context.grouped, 3, 1)), 3);
assert.equal((context.findSubtitleIndexForOffset(context.grouped, 3, -1)), 0);

console.log("Subtitle parser infrastructure tests passed");

dom.window.close();
