import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {
    console,
    video: { currentTime: 5 },
    globalSubDelay: 0,
    lastClickedSubtitleIdx: null,
    subtitles: []
};
vm.createContext(context);

for (const file of [
    "dist/js/subtitles/parsing.js",
    "dist/js/subtitles/timing.js",
    "dist/js/subtitles/navigation.js"
]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

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

const parsed = context.parseASS(ass);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].alignment, 8);
assert.equal(parsed[0].positionX, 960);
assert.equal(parsed[0].positionY, 100);
assert.equal(parsed[0].fontName, "Arial");
assert.equal(parsed[0].primaryColor, "#FFFFFF");

context.subtitles = parsed;
assert.equal(context.getPrimarySubtitleIndex(), 1, "bottom dialogue should beat a positioned sign");
context.lastClickedSubtitleIdx = 0;
assert.equal(context.getPrimarySubtitleIndex(), 0, "an explicit active selection should win");

const grouped = [
    { start: 1, end: 2, text: "one" },
    { start: 3, end: 5, text: "two-a" },
    { start: 3.01, end: 4, text: "two-b" },
    { start: 7, end: 8, text: "three" }
];
assert.equal(context.findSubtitleIndexForOffset(grouped, 3, 1), 3);
assert.equal(context.findSubtitleIndexForOffset(grouped, 3, -1), 0);

console.log("Subtitle model tests passed");
