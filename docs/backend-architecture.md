# Backend architecture

## Application and settings

`create_app(settings, initialize=True)` creates the Flask application. Imports do not start the server or contact Anki.
`Settings` holds all configuration. Routes use `current_settings()`. Background work receives settings as an argument.
Logging setup keeps existing root handlers.

Startup copies missing legacy data before it creates directories. Existing destination files stay unchanged.
Cover path migration changes only legacy paths. Repeated startup keeps current paths unchanged.
Startup then prepares the database and starts the stale Anki check.

## Routes and services

Routes check input and call services. Services contain application rules. Repositories contain database queries.
`video_service.resolve_media_file()` checks a library file ID, its resolved path, its library root, and its disk state.
Video export, candidate export, and playback routes share this check.

Media routes reject path separators, unsupported extensions, and paths outside the configured root.
Series relink checks the selected path against the media library root before a recursive scan.
`POST /library/scan` starts a scan. `GET /library/scan` returns 405.
Candidate list and candidate creation use separate GET and POST handlers.

Anki synchronization uses `services/anki_word_sync_service.py`. Pure word rules use `services/anki_word_model.py`.
Text cleanup uses `text_processing.strip_html()`. Its documented options preserve each caller's existing output.

## HTTP downloads

`http_client.py` supplies bounded reads and JSON requests. Anki keeps a small adapter for its action protocol and response checks.
Cover downloads validate each redirect and pin the checked public IP address for the connection.
TLS still checks the original host name. Proxy settings cannot bypass the pinned connection.
Subtitle downloads accept approved HTTPS hosts and subtitle extensions. They enforce the five MiB limit during the read.
Both download paths reject file URLs before network access.

## SQLite

`connection.py` sets the connection timeout and busy timeout to five seconds.
`get_db(..., immediate=True)` owns the write transaction for candidate claims and updates.
A concurrent writer waits for that transaction. Exceptions roll back changes.
The migration runner enables WAL for both new and existing databases during initialization.
It locks schema changes and commits migrations with their version update.

`episode_file_query.py` supplies the shared primary-file query.
`playback_repository.get_library_file_by_id()` reads a file without changing its existence flag.
Scans and `POST /library/refresh-files` update disk existence. Refresh batches contain up to 500 IDs.

## Responses and jobs

API errors use `{ok: false, error: {code, message}}`. The response helper can add a request ID and error details.
Unexpected errors use a neutral message and a logged request ID. Input errors return 400. Upstream errors return 502.
The response normalizer accepts older service payloads and returns the same error shape.

The job service limits stored jobs by age and count. Active jobs remain available.
Browser job polling has a deadline and supports cancellation. Cancellation does not undo accepted server work.
