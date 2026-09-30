import sys
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.settings import Settings


@pytest.fixture
def temporary_settings(tmp_path: Path) -> Settings:
    data_dir = tmp_path / "data"
    frontend_dir = tmp_path / "frontend"
    anki_media_dir = tmp_path / "anki-media"

    return Settings(
        project_dir=tmp_path,
        base_dir=tmp_path,
        data_dir=data_dir,
        frontend_dir=frontend_dir,
        video_dir=data_dir / "UploadedVideos",
        anki_highlight_dir=data_dir / "anki_highlight",
        anki_media_dir=anki_media_dir,
        screenshot_dir=anki_media_dir,
        audio_dir=anki_media_dir,
        media_library_dir=tmp_path / "media-library",
        dedupe_index_path=data_dir / "dedupe_index.json",
        library_db_path=data_dir / "library.sqlite3",
        library_covers_dir=data_dir / "LibraryCovers",
        fonts_dir=frontend_dir / "fonts",
        allowed_origin=None,
        allowed_video_extensions={".mp4", ".mkv", ".avi", ".mov", ".webm"},
        allowed_subtitle_extensions={".srt", ".ass", ".vtt"},
        port=5000,
        jimaku_api_token="",
        anki_highlight_auto_refresh="never",
        anki_highlight_auto_refresh_hour=4,
        anki_highlight_auto_refresh_minute=0,
    )
