import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import kuromoji from "kuromoji";

class HeadlessVTTCue extends EventTarget {
  constructor(startTime, endTime, text) {
    super();
    Object.assign(this, { id: "", startTime, endTime, text, pauseOnExit: false });
  }
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "..");
const context = { console: { log() {}, warn() {}, error() {} }, Event, EventTarget, ReadableStream };
context.window = context;
context.window.VTTCue = HeadlessVTTCue;
context.normalizeHighlightWord = (value) => String(value || "").replace(/<[^>]*>/g, "").trim();
vm.createContext(context);

for (const relative of [
  "dist/js/subtitles/model.js", "dist/js/subtitles/parser-types.js",
  "dist/js/subtitles/format-detection.js", "dist/js/subtitles/normalization.js",
  "dist/js/subtitles/parsing.js", "dist/js/subtitles/parsers/legacy-parser.js",
  "dist/js/subtitles/parsers/external-parser.js", "frontend/libs/media-captions/media-captions.js",
  "dist/js/subtitles/parsers/media-captions-ass-metadata.js",
  "dist/js/subtitles/parsers/media-captions-parser.js", "dist/js/subtitles/parser-registry.js",
  "dist/js/subtitles/parse-subtitle-source.js", "dist/js/highlighter/anki-match-model.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
}

const tokenizer = await new Promise((resolve, reject) => kuromoji.builder({
  dicPath: path.join(root, "node_modules", "kuromoji", "dict")
}).build((error, result) => error ? reject(error) : resolve(result)));

const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const output = [];
for (const item of payload.files || []) {
  context.subtitleSource = fs.readFileSync(item.path, "utf8");
  context.subtitleFormat = path.extname(item.path).slice(1).toLowerCase();
  const parsed = await vm.runInContext(
    "parseSubtitleSource({ source: subtitleSource, format: subtitleFormat })", context
  );
  for (const cue of parsed.cues) {
    const tokens = tokenizer.tokenize(String(cue.text || ""));
    context.currentTokens = tokens;
    const analyzed = vm.runInContext(`currentTokens.map(token => ({
      surface: token.surface_form, basic: token.basic_form, reading: token.reading,
      pos: token.pos, posDetail: token.pos_detail_1, position: token.word_position,
      candidates: getJapaneseTokenCandidates(token)
    }))`, context);
    output.push({ episodeId: item.episodeId, episode: item.episode, start: cue.startTime,
      end: cue.endTime, sentence: cue.text, tokens: analyzed });
  }
}
process.stdout.write(JSON.stringify(output));
