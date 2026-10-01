# Technical debt results — 2026-10-01

## Scope and phases

This report replaces the previous seven-phase report. The archived prompt is historical reference only.

| Phase | Result | Commit |
| --- | --- | --- |
| 1 | Media path checks, bounded downloads, pinned cover connections, explicit scan POST, SQLite write locks, passive file reads | `cfb5098` |
| 2 | Shared media resolution, one API error shape, shared HTTP calls, documented HTML modes, logging cleanup | `7c8993f` |
| 3 | Full strict TypeScript, explicit domain types, null guards, mandatory CI check | `aa800f4` |
| 4 | Shared retries, catalog types, time and HTML helpers, notifications, safe cover URLs, independent bulk view | `cb05bc1` |
| 5 | Tests for remaining modules, startup and search fixes, explicit test groups, current documentation | This commit |

Each phase has its own commit. Checks ran again after each commit. The root repomix file remains ignored.

## Checks

The starting audit counted 59 output lines, but the compiler reported 47 strict errors.
The explicit `noImplicitAny: false` setting hid more errors. Full strict mode exposed 113 errors, all now fixed.
`tsconfig.json` enables strict mode without weaker overrides. CI requires strict checks.

Final checks pass: 172 Python tests, Ruff, normal TypeScript, strict TypeScript, and `npm run check`.
Strict TypeScript reports zero errors. Documentation prose scores range from 0.00 to 0.88 findings per 100 words.
Frontend tests use jsdom and mocked services. Both page startup tests run once with an explicit page argument.
The earlier runner used a default player argument, so the reported duplicate library startup was not present.
The library test group now includes async tests, API and binding tests, and modal tests.
Pytest uses separate temporary directories instead of one shared fixed directory.

## Bugs and regression coverage

| Bug or risk | Regression coverage |
| --- | --- |
| Video traversal and relink outside the library | Media and library route tests |
| File URLs, oversized downloads, and DNS changes | Cover and subtitle download tests |
| Mutating scan GET | GET returns 405 and the browser sends POST |
| Competing candidate claims and transaction rollback | Concurrent repository tests and connection tests |
| File lookup changed database state | Passive-read test |
| Repeated startup added extra data prefixes to cover paths | Repeated current and legacy path migration tests |
| Directory creation prevented legacy cover copy | Repeated startup test and current-file preservation test |
| An old search response replaced another series' results | Modal race and closed-modal response tests |
| Structured API errors displayed as an object | Modal error-message and HTML escaping assertions |
| Failed upload or progress save damaged client state | Player flow tests |

Additional tests cover dedupe recovery, media resolution, HTML modes, settings precedence, deletion, hotkeys, media playback, and settings storage.

## Deletion audit

Each removal followed a reference search across `backend/`, `frontend/js/`, and `tests/`.

| Removed code | Previous callers | Replacement or reason |
| --- | --- | --- |
| Playback `_mark_missing_files` and repeated ID query | `get_library_file_by_id` | Explicit refresh updates disk state |
| `subtitle_conversion_service.py` and its test file | Its own conversion helper and three tests only | No production callers |
| Cover-search `_http_json_post` and unused urllib imports | Cover search and its test stub | Shared `http_client.post_json` |
| `legacy_error_response` | Media routes and response helpers | `error_response` and `normalize_payload` |
| Candidate service's local import | Candidate media resolution | Module import and shared resolver |
| `fetchWithRetry` and `retryOnRateLimit` | Anki API, library subtitle workflow, retry tests | `requestWithRetry` |
| Page cover, subtitle, bulk, HTML, and time proxies | Library bindings, bulk view, page templates | Direct controller, model, and helper calls |
| Separate library locale files | Library translation helper | Typed common catalog |
| Parser time formatter | Subtitle sidebar and model tests | Common formatter with explicit format |
| Duplicate toast CSS and player notification implementation | Player themes and UI exports | Common notification module and stylesheet |
| Inline console calls and empty HTML assignments | Frontend modules | Logger and `replaceChildren()` |

## Deliberate limits

The shared search modal already existed. This work removed proxies and fixed its response race instead of creating another abstraction.
The duplicate library file query was already absent from the baseline library repository.
The Anki request adapter remains because it handles protocol semantics. The cover opener remains because it pins checked IP addresses.
`json_object()` remains because it rejects arrays. It is not equivalent to `get_json() or {}`.
Time formats and the previous fractional-millisecond rounding stay unchanged.
Old paths already damaged by earlier startup runs need a separate repair policy. This change prevents further repeated prefixes.

`NEXT.md` remains ignored. It now distinguishes existing helpers from unfinished UI work.
Live Anki, live subtitle providers, browser layout, and actual video playback were not tested against external services.

Next recommendation: add one browser smoke test that opens a video and sends a card to Anki.
