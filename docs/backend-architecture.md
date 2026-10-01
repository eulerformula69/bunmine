# Backend layers

## Application setup

`backend.app.create_app(settings, initialize=True)` creates the Flask application. Importing backend modules does not create directories, run migrations, or contact Anki.

`server.py` creates the application only when run as a program. Startup prepares data directories, runs migrations, and starts the stale Anki check. Tests use temporary settings and `initialize=False` when startup is not under test.

## Settings

`backend.settings.Settings` is the single configuration object. Routes get it through `current_settings()`, which reads `app.config["SETTINGS"]`. Background work receives it as an argument and does not depend on a Flask request.

## Routes and services

Routes validate request data, call application logic, and shape responses. Anki synchronization lives in `services/anki_word_sync_service.py`. Its pure status and schedule rules live in `services/anki_word_model.py`. Startup imports services, never routes.

Media services handle export, conversion, and fonts. Library operations use `library_scanner.py`, `library_subtitles.py`, and the cover modules. `http_client.py` supplies bounded HTTP reads. `text_processing.py` supplies shared HTML removal with caller-specific options.

## Repositories and migrations

Repositories contain database queries. `connection.py` sets a five-second busy timeout. The migration runner enables WAL for a new database. It takes a write lock before reading the schema version. Pending migrations and the new version commit in one transaction.

`episode_file_query.py` defines the shared primary-file selection query. Library reads trust the stored file-existence flag. Scans and `POST /library/refresh-files` check disk state. Updates use batches of 500 IDs.

## Errors and jobs

`api_response.py` logs exceptions with a request ID. Error responses contain a neutral message and the same ID, not internal exception text. Invalid values return 400. Upstream HTTP errors return 502. Other failures return 500.

The job service limits retained jobs by age and count. It keeps active jobs and rejects new work when capacity is full. Browser polling has a deadline and supports cancellation. Cancelling a browser request does not undo work the server already completed.
