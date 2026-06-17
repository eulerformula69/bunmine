import os
import shutil
import threading

from backend.library_db import get_db, init_library_db
from backend.routes.misc_routes import ensure_anki_highlight_files, refresh_known_anki_words_if_stale_on_startup
from backend.settings import Settings

_startup_stale_check_started = False


def start_anki_highlight_startup_stale_check() -> None:
    """Run one stale auto-refresh check after backend startup."""
    global _startup_stale_check_started
    if _startup_stale_check_started:
        return
    _startup_stale_check_started = True

    def worker() -> None:
        try:
            result = refresh_known_anki_words_if_stale_on_startup()
            print(f"Anki highlight startup stale-check result: {result}")
        except Exception as err:
            print(f"Anki highlight startup stale-check skipped/failed: {err}")

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


def ensure_directories(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.video_dir.mkdir(parents=True, exist_ok=True)
    settings.screenshot_dir.mkdir(parents=True, exist_ok=True)
    settings.anki_highlight_dir.mkdir(parents=True, exist_ok=True)
    settings.library_covers_dir.mkdir(parents=True, exist_ok=True)
    settings.fonts_dir.mkdir(parents=True, exist_ok=True)


def migrate_legacy_data_paths(settings: Settings) -> None:
    legacy_files = [
        (settings.base_dir / "library.sqlite3", settings.library_db_path),
        (settings.base_dir / "dedupe_index.json", settings.dedupe_index_path),
    ]
    for source, target in legacy_files:
        if source.exists() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    legacy_dirs = [
        (settings.base_dir / "anki_highlight", settings.anki_highlight_dir),
        (settings.frontend_dir / "LibraryCovers", settings.library_covers_dir),
    ]
    for source, target in legacy_dirs:
        if source.exists() and not target.exists():
            shutil.copytree(source, target)


def cleanup_on_startup(settings: Settings) -> None:
    print("--- Cleaning temporary files ---")

    if settings.dedupe_index_path.exists():
        try:
            settings.dedupe_index_path.unlink()
            print(f"Deleted dedupe index: {settings.dedupe_index_path}")
        except Exception as err:
            print(f"Could not delete dedupe index: {err}")

    for item in os.listdir(settings.video_dir):
        item_path = settings.video_dir / item
        if item.startswith("temp_") or item.endswith((".mp4", ".mkv", ".avi", ".mov", ".webm", ".srt", ".ass", ".vtt")):
            try:
                item_path.unlink()
                print(f"Deleted file: {item}")
            except Exception as err:
                print(f"Could not delete {item}: {err}")


def initialize_backend(settings: Settings) -> None:
    ensure_directories(settings)
    migrate_legacy_data_paths(settings)
    ensure_anki_highlight_files()
    start_anki_highlight_startup_stale_check()
    cleanup_on_startup(settings)
    init_library_db(settings.library_db_path)
    migrate_cover_paths(settings)


def migrate_cover_paths(settings: Settings) -> None:
    old_fragment = f"{os.sep}LibraryCovers{os.sep}"
    new_fragment = f"{os.sep}data{os.sep}LibraryCovers{os.sep}"

    with get_db(settings.library_db_path) as conn:
        conn.execute(
            """
            UPDATE library_files
            SET path = REPLACE(path, ?, ?)
            WHERE file_type = 'cover' AND path LIKE '%' || ? || '%'
            """,
            (old_fragment, new_fragment, old_fragment),
        )
        conn.execute(
            """
            UPDATE library_files
            SET relative_path = REPLACE(relative_path, 'frontend/LibraryCovers/', 'data/LibraryCovers/')
            WHERE file_type = 'cover' AND relative_path LIKE 'frontend/LibraryCovers/%'
            """
        )
        conn.execute(
            """
            UPDATE library_files
            SET relative_path = REPLACE(relative_path, 'LibraryCovers/', 'data/LibraryCovers/')
            WHERE file_type = 'cover' AND relative_path LIKE 'LibraryCovers/%'
            """
        )
