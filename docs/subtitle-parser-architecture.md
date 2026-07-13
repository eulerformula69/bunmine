# Subtitle parser architecture

## Data flow

Subtitle files enter the frontend through `parseSubtitleSource`. The facade resolves a provider, asks it to parse the source, normalizes its result, and returns Bunmine `SubtitleCue[]`. A temporary compatibility mapper converts those cues to `RuntimeSubtitleCue[]` for the existing timing, overlay, sidebar, highlighting, context, Anki, and media-export code.

```text
SRT / VTT / ASS / SSA
        -> SubtitleParser provider
        -> normalized Bunmine SubtitleCue[]
        -> temporary runtime mapper
        -> existing frontend consumers
```

## Contracts and model

`SubtitleCue` uses seconds and the unambiguous `startTime` and `endTime` fields. Text is DOM-independent. Common ASS positioning and style values are normalized fields because the current renderer uses them; provider-specific or rare source data belongs in read-only `metadata`.

Every provider implements `SubtitleParser`, returns only Bunmine types, and may perform synchronous or asynchronous work behind its promise-based `parse` method. The rest of the application must not import or inspect types from a parsing library.

## Providers and registry

`LegacySubtitleParser` wraps the current SRT/VTT and ASS/SSA functions. It is registered by default. `SubtitleParserRegistry.register` gives a newly registered provider priority for the formats it supports, while `resolve` rejects unknown or unsupported formats with `SubtitleParseError`.

`ExternalSubtitleParser` is an unregistered adapter scaffold. Its loader result is mapped at `mapExternalSubtitleCues`; external cue types do not cross that boundary. A future integration is deliberately small:

```ts
const externalParser = new ExternalSubtitleParser(
    "some-library",
    ["srt", "vtt", "ass", "ssa"],
    async (input) => someLibraryParse(input.source)
);
subtitleParserRegistry.register(externalParser);
```

The library-specific adapter should translate all timing, text, style, position, warning, and error values there. Do not make UI, video, timing, sidebar, highlighting, context selection, Anki, or media export depend on that package.

## Detection, normalization, and errors

Format detection prefers an explicit format, then filename extension, MIME type, conservative content signatures, and finally `unknown`. Normalization rejects non-finite times with warnings, clamps negative times to zero, ensures the end is not before the start, normalizes CRLF, and creates deterministic IDs. It preserves input order, overlaps, equal timecodes, Japanese text, and normalized ASS properties.

The facade preserves `SubtitleParseError` and wraps an arbitrary provider exception as `provider-failed`, retaining the original exception in `cause`. UI code should display a localized safe message rather than the cause or stack trace.

## Compatibility boundary

`RuntimeSubtitleCue` retains the historical `start` and `end` names. `toRuntimeSubtitleCues` is the only intended bridge from the parser result to that runtime model. The bridge preserves every ASS field currently read by the renderer. It can be removed later by migrating consumers to `startTime` and `endTime`; provider adapters and the public parser facade should not change during that migration.
