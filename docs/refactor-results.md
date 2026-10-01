# Refactor results

Prose lint score: 0.98 findings per 100 words (STE-flavored).

## Scope

All seven phases are complete. Each phase has its own commit or several commits for separate changes.
The final phase includes the bug fixes requested in the prompt.
The unused Jimaku routes were removed as requested in phase 4.
The subtitle download response keeps `subtitlePath` and adds `subtitleFilename` for the repaired row display.

## Checks

The full output of the four requested commands is in `refactor-verification.txt`.
Python: 137 tests passed. Normal TypeScript and Ruff checks passed.
Strict TypeScript: 47 errors remain, below the limit of 50. Strict mode remains off as requested.
`npm run check` passed, including all frontend tests and both page startup tests.
`npm run build` passed. No frontend TypeScript file exceeds 350 lines.

## Remaining work

- The 47 strict errors need a separate type cleanup before strict mode can become the default.
- Fonts remain in Git to preserve offline startup. A download script needs a source, version, and license audit first.
- Tests use jsdom and mocked services. Real browser layout, playback, and live Anki/Jimaku integration still need end-to-end coverage.
- Cancellation stops client requests and queued work. It does not undo work that the server already accepted.
- `NEXT.md` stays ignored because it contains local planning notes.

Next recommendation: add one real-browser smoke test for opening a video and sending a card to Anki.

## Bugs and regression tests

| Change | Test coverage |
|---|---|
| Import no longer starts the application | Import safety and temporary settings tests |
| Cover downloads reject unsafe URLs, private addresses, and oversized responses | `test_library_covers.py` |
| ffmpeg has a timeout | `test_ffmpeg_service.py` |
| Migrations read the version after the write lock and roll back together | `test_migrations.py` |
| Library reads no longer scan files or mark all files missing | Library database and route tests |
| Manual Anki refresh no longer delays automatic refresh | `test_anki_word_sync.py` |
| Subtitle selection updates the actual row elements | `library-subtitle-controller-tests.mjs`, `test_library_routes.py` |
| Bulk download cancellation stops active and queued client work | `library-async-tests.mjs` |
| Job polling has a deadline and supports cancellation | `library-async-tests.mjs` |
| HTML escaping includes apostrophes | `library-presentation-tests.mjs` |
| Jimaku cache reuse, expiry, and filename selection | `test_library_subtitles.py` |
| Page modules start with the real HTML structure | `module-startup-tests.mjs` |

## Removal audit

Search scope: `backend`, `frontend/js`, and `tests`. Line references below use baseline commit `8e71584`.
The search covered imports, direct calls, and references before each removal.

| Removed or replaced item | References found before removal |
|---|---|
| `backend.config` | `library_subtitles`, `misc_routes`, `anki_highlight_store`, `dedupe_service`, `vocabulary_report_service`. These now read Settings. |
| `_init_jimaku_cache_table` | Only `_cached_http_json_get` in `library_subtitles.py:64`. Migration 001 now owns the table. |
| `get_missing_jimaku_subtitle_candidates` | `subtitle_routes.py:13,77`. No frontend or test calls. |
| `build_missing_jimaku_subtitle_plan` | `subtitle_routes.py:10,149`. No frontend or test calls. |
| `bulk_download_missing_jimaku_subtitles` | `subtitle_routes.py:12,172`. No frontend or test calls. |
| `_safe_subtitle_name`, `_episode_label` | Definitions only in `library_subtitles.py:103,109`. |
| `last_heartbeat`, `_report_files` | Definitions only in `app_state.py:6` and `vocabulary_report_routes.py:11`. |
| Duplicate `get_library_file_by_id` | `file_routes.py:16,128`, `video_service.py:4,24`, `candidate_service.py:15,16`. All now use the playback repository. |
| `library_service.delete_library_series` | Definition and its own delegation only, lines 111,113. The real deletion service remains. |
| Four unused Anki helpers | `hasRequiredAnkiMediaFields`, `normalizeSelectedAnkiWord`, `isKanaOnly`, `escapeAnkiFieldText`: definitions only in `anki-actions.ts`. |
| Old highlighter `ankiRequest` | Definition only. The shared Anki client replaces duplicate request code. |
| Three old toast helpers | `formatToastMessage`, `showTranslatedToast`, `showPersistentActionToast`: definitions only. |
| `playerContext` | `app.ts:29` read the DOM field. No readers for its state or dictionary fields. Direct imports replace it. |
| `getSubtitleSearchDict` | Local definition and call in `search-panel.ts`. Shared translation lookup replaces it. |
| Duplicate language change handler | Two assignments in `settings.ts`. The main handler remains. |
| `_target_subtitle_path` unused arguments | One caller in `library_subtitles.py`. Removed `source` and `entry_id` from both sites. |
| Unused browser test | No callers or package scripts referenced `player-pointer-browser-tests.mjs`. |

The following translation keys had no callers outside their definitions in three language catalogs:

```text
hideSubs
showSubs
closeSubtitlesPanel
defaultAudio
toastAutoAttachWaiting
toastAutoAttachSnapshotReady
toastAutoAttachAlreadyWaiting
toastAutoAttachCancelled
toastAutoAttachSelectionCleared
toastAutoAttachQueued
toastAutoAttachListeningQueued
toastAutoAttachAddingQueued
toastAutoAttachDoneQueued
toastVideoRestoredNoSubtitles
toastKnownBasicAdded
```

This removed 45 unused translation entries, not visible interface text.
