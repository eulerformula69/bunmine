# Frontend Dependency Audit

This is the baseline map before the TypeScript migration. The current runtime contract is script-order globals loaded by `frontend/js/bootstrap.js` and `frontend/js/library-bootstrap.js`.

## Large Files

- `frontend/js/library/library.js` (~76 KB): library API calls, modal state, rendering, event binding, scan/job polling, cover/subtitle workflows.
- `frontend/js/player/app.js` (~56 KB): player bootstrapping, playback loop, Anki actions, target note UI, hotkeys, runtime highlighter refresh.
- `frontend/js/subtitles/subtitles-sidebar.js` (~30 KB): sidebar layout, search, context depth selection, rendering, navigation.
- `frontend/js/core/i18n.js` (~24 KB): translations and language application.
- `frontend/js/highlighter/anki-highlighter.js` (~19 KB): Anki known-word cache, refresh, runtime status matching.
- `frontend/js/video/video.js` (~18 KB): uploads, current video restore, library playback restore, video picker, progress persistence.

## Module Map

- `core/api`: depends on `window.location`, `fetch`; used by player, video, audio tracks, highlighter, library.
- `core/dom`: depends on `document`; creates the shared `dom` object for player-side scripts.
- `core/i18n`: depends on `document`, `localStorage`, `BunmineState.currentLang`; used by player UI/settings/sidebar and library labels.
- `core/state`: creates `window.BunmineState` and legacy global accessors such as `subtitles`, `globalSubDelay`, `currentVideoFile`.
- `player/*`: depends on `dom`, `i18n`, `apiJson`, subtitle helpers, video helpers, highlighter helpers, and many `BunmineState` globals.
- `subtitles/*`: depends on `video`, `sidebar`, `subtitles`, `globalSubDelay`, i18n, tokenizer/highlighter globals, DOM APIs.
- `video/*`: depends on `apiJson`, `buildApiUrl`, `dom` globals, `subtitles`, library episode globals, localStorage, and UI helpers.
- `library/*`: depends on `apiJson`, DOM APIs, local translation helpers embedded in `library.js`; currently isolated from player state.
- `highlighter/*`: depends on `apiJson`, settings DOM fields, tokenizer helpers, localStorage/cache data, subtitle rendering hooks.
- `japanese/*`: depends on global `kuromoji`; exports tokenizer helpers as globals.

## Globals To Remove Gradually

- State globals from `core/state`: `subtitles`, `globalSubDelay`, `subtitleElements`, `currentVideoFile`, `currentLibraryEpisodeId`, `selectedKnownBasicWord`, search/context globals, runtime prefetch globals.
- DOM globals from `core/dom`: `video`, `sidebar`, `multiInput`, `overlay`, `progress`, `targetNoteSelect`, etc.
- Function globals: `apiJson`, `buildApiUrl`, `getApiErrorMessage`, subtitle rendering/search helpers, highlighter refresh helpers, tokenizer helpers, settings helpers.
- Browser storage keys used across modules: `subtitlePlayerSettings`, highlighter cache keys, video progress state.

## Migration Boundary

First boundary to stabilize: keep global runtime compatibility, but type shared API and state/context shapes. Then domains can switch from implicit globals to explicit `PlayerContext`, `LibraryContext`, and `AppSettings` parameters one module at a time.
