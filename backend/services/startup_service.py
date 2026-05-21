import os
import threading
import time
from datetime import datetime, timedelta

from backend.config import (
    ANKI_HIGHLIGHT_AUTO_REFRESH,
    ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR,
    ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE,
    ANKI_HIGHLIGHT_DIR,
    DEDUPE_INDEX_PATH,
    FONTS_DIR,
    LIBRARY_DB_PATH,
    LIBRARY_COVERS_DIR,
    SCREENSHOT_DIR,
    VIDEO_DIR,
)
from backend.library_db import get_db, init_library_db
from backend.routes.misc_routes import ensure_anki_highlight_files, refresh_known_anki_words_auto

_auto_refresh_thread_started = False


def _seconds_until_next_auto_refresh() -> float:
    now = datetime.now()
    target = now.replace(
        hour=max(0, min(23, ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR)),
        minute=max(0, min(59, ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE)),
        second=0,
        microsecond=0,
    )

    if target <= now:
        target += timedelta(days=1)

    if ANKI_HIGHLIGHT_AUTO_REFRESH == "weekly":
        # Monday local time. If today is Monday and the target time is still ahead, use today.
        days_until_monday = (0 - target.weekday()) % 7
        if days_until_monday:
            target += timedelta(days=days_until_monday)

    return max(60.0, (target - now).total_seconds())


def _anki_highlight_auto_refresh_loop() -> None:
    while True:
        time.sleep(_seconds_until_next_auto_refresh())
        try:
            result = refresh_known_anki_words_auto()
            print(f"Anki highlight auto-refresh result: {result}")
        except Exception as err:
            print(f"Anki highlight auto-refresh failed: {err}")


def start_anki_highlight_auto_refresh() -> None:
    global _auto_refresh_thread_started
    if _auto_refresh_thread_started:
        return
    if ANKI_HIGHLIGHT_AUTO_REFRESH not in {"daily", "weekly"}:
        print("Anki highlight auto-refresh disabled")
        return

    _auto_refresh_thread_started = True
    thread = threading.Thread(target=_anki_highlight_auto_refresh_loop, daemon=True)
    thread.start()
    print(
        "Anki highlight auto-refresh enabled: "
        f"{ANKI_HIGHLIGHT_AUTO_REFRESH} at "
        f"{ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR:02d}:{ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE:02d}"
    )


def ensure_directories() -> None:
    os.makedirs(VIDEO_DIR, exist_ok=True)
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    os.makedirs(ANKI_HIGHLIGHT_DIR, exist_ok=True)
    os.makedirs(LIBRARY_COVERS_DIR, exist_ok=True)
    os.makedirs(FONTS_DIR, exist_ok=True)


def cleanup_on_startup() -> None:
    print("--- Очистка временных файлов ---")

    if DEDUPE_INDEX_PATH.exists():
        try:
            DEDUPE_INDEX_PATH.unlink()
            print(f"Удален dedupe index: {DEDUPE_INDEX_PATH}")
        except Exception as err:
            print(f"Не удалось удалить dedupe index: {err}")

    for item in os.listdir(VIDEO_DIR):
        item_path = os.path.join(VIDEO_DIR, item)
        if item.startswith("temp_") or item.endswith((".mp4", ".mkv", ".avi", ".mov", ".webm", ".srt", ".ass", ".vtt")):
            try:
                os.remove(item_path)
                print(f"Удален файл: {item}")
            except Exception as err:
                print(f"Не удалось удалить {item}: {err}")


def initialize_backend() -> None:
    ensure_directories()
    ensure_anki_highlight_files()
    start_anki_highlight_auto_refresh()
    cleanup_on_startup()
    init_library_db(LIBRARY_DB_PATH)
    migrate_cover_paths()


def migrate_cover_paths() -> None:
    old_fragment = f"{os.sep}LibraryCovers{os.sep}"
    new_fragment = f"{os.sep}frontend{os.sep}LibraryCovers{os.sep}"

    with get_db(LIBRARY_DB_PATH) as conn:
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
            SET relative_path = REPLACE(relative_path, 'LibraryCovers/', 'frontend/LibraryCovers/')
            WHERE file_type = 'cover' AND relative_path LIKE 'LibraryCovers/%'
            """
        )
