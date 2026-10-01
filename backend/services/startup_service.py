import os
import shutil
import threading
import logging

from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db
from backend.services.anki_highlight_store import ensure_anki_highlight_files
from backend.services.anki_word_sync_service import refresh_known_anki_words_if_stale_on_startup
from backend.settings import Settings

_startup_stale_check_started = False
logger = logging.getLogger(__name__)


def start_anki_highlight_startup_stale_check(settings: Settings) -> None:
    """Run one stale auto-refresh check after backend startup."""
    global _startup_stale_check_started
    if _startup_stale_check_started:
        return
    _startup_stale_check_started = True

    def worker() -> None:
        try:
            result = refresh_known_anki_words_if_stale_on_startup(settings)
            logger.info("Anki highlight startup check: %s", result)
        except Exception:
            logger.exception("Anki highlight startup check failed")

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
    logger.info("Cleaning temporary files")

    if settings.dedupe_index_path.exists():
        try:
            settings.dedupe_index_path.unlink()
            logger.info("Deleted dedupe index: %s", settings.dedupe_index_path)
        except Exception:
            logger.exception("Could not delete dedupe index")

def initialize_backend(settings: Settings) -> None:
    ensure_directories(settings)
    migrate_legacy_data_paths(settings)
    ensure_anki_highlight_files(settings)
    start_anki_highlight_startup_stale_check(settings)
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
