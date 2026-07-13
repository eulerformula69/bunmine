# Subtitle parser architecture

## Data flow

Subtitle files enter the frontend through `parseSubtitleSource`. The facade tries registered providers in priority order, normalizes the first successful result, and returns Bunmine `SubtitleCue[]`. A temporary compatibility mapper converts those cues to `RuntimeSubtitleCue[]` for timing, overlay, sidebar, highlighting, context, Anki, and media export.

```text
SRT / VTT / ASS / SSA
        -> media-captions provider
        -> legacy provider on expected incompatibility
        -> normalized Bunmine SubtitleCue[]
        -> temporary runtime mapper
        -> existing frontend consumers
```

## Library and browser build

The primary provider uses `media-captions` 0.0.18. It was selected because it has no runtime dependencies, works in browsers, exposes a promise-based `parseText` API with recoverable errors, and supports SRT, WebVTT, ASS, and SSA through one cue model.

The application still compiles TypeScript with `module: "None"`. `tools/build-media-captions.mjs` therefore uses esbuild to generate an unminified IIFE at `frontend/libs/media-captions/media-captions.js`. The generated file is ignored by Git and rebuilt by `npm run build`. `bootstrap.ts` loads it before `media-captions-parser.js` and the provider registry. No general-purpose frontend bundler or module migration was introduced.

The startup dependency check includes TypeScript, esbuild, `media-captions`, and `kuromoji`, so an old partial `node_modules` directory triggers `npm install` before the frontend build. Like `media-captions`, the pinned `kuromoji` package is materialized into the ignored `frontend/libs` runtime directory by `npm run build`; its JavaScript bundle and dictionary are no longer stored in the repository.

## Contracts and mapping

`SubtitleCue` uses seconds and the unambiguous `startTime` and `endTime` fields. Text is DOM-independent. Common ASS positioning and style values are normalized fields; library-specific VTT settings remain in read-only `metadata`.

`MediaCaptionsSubtitleParser` is the only application adapter that describes the library cue shape. It maps:

- library `id`, `startTime`, `endTime`, and cue text to Bunmine `id`, `startTime`, `endTime`, `rawText`, and plain `text`;
- VTT `line`, `position`, `size`, alignment, region ID, and related settings to `metadata.settings`;
- library parser errors to `SubtitleParseWarning`;
- the provider name and library CSS-style snapshot to `metadata`.

The library already converts SRT/VTT/ASS timestamp fractions to seconds. Normalization rejects non-finite times, clamps negative times to zero, ensures the end is not before the start, normalizes CRLF, and creates deterministic IDs when the library does not provide one. Input order, overlaps, identical timecodes, and Japanese text are preserved.

## ASS and SSA metadata

`media-captions` parses ASS/SSA timing and text and exposes resolved CSS-like style data, but does not expose the original style name, layer, `PlayRes`, `\\an`, or `\\pos` fields. The adapter contains a narrow source-metadata extractor for those values and matches them to library cues by start/end time. This preserves the fields already used by Bunmine's overlay without moving ASS parsing into UI code.

The adapter preserves layer, style name, alignment, position, PlayRes, font name, font size, primary color, bold, and italic when they exist in the source. It does not implement the full ASS override-tag language, animation, karaoke, drawing commands, collision layout, or libass rendering. Complex files can still differ visually from libass.

## Provider order and fallback

The registry order is:

1. `media-captions` for SRT, VTT, ASS, and SSA;
2. `legacy` for the same formats.

`resolveAll` returns this finite ordered list. The facade falls back only when a provider throws `external-format-incompatible` or `external-empty-result`, and adds a `provider-fallback` warning. Arbitrary exceptions are wrapped as `provider-failed` and are not hidden. Providers never call the facade, so fallback cannot recurse.

To make the legacy parser primary during a regression, remove or temporarily disable this registration in `parser-registry.ts`:

```ts
subtitleParserRegistry.register(new MediaCaptionsSubtitleParser());
```

The legacy parser and its parsing functions remain available and tested.

## Existing backend compatibility

Local SRT, VTT, ASS, and SSA files are now parsed immediately in the browser. Upload still sends the original subtitle to the existing backend. The backend ASS-to-SRT conversion and old upload API remain unchanged, so a later restore may receive converted SRT; format detection and the primary provider handle that response normally. Library playback also continues to accept the backend subtitle URL and parses whichever supported format is returned.

## Compatibility boundary

`RuntimeSubtitleCue` retains the historical `start` and `end` names. `toRuntimeSubtitleCues` is the only bridge from parser results to that runtime model and preserves every ASS field currently read by the renderer. UI, video timing, sidebar, highlighting, context selection, Anki, screenshot/audio endpoints, and playback code do not depend on `media-captions` types.

After the provider has stabilized, the runtime mapper and `RuntimeSubtitleCue` can be removed by migrating consumers to `startTime` and `endTime`. The legacy parser and backend ASS-to-SRT fallback can be removed only after real subtitle corpora and deployment telemetry show that the external provider covers them safely.
