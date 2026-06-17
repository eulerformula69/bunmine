import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class Settings:
    project_dir: Path
    base_dir: Path
    data_dir: Path
    frontend_dir: Path
    video_dir: Path
    anki_highlight_dir: Path
    anki_media_dir: Path
    screenshot_dir: Path
    audio_dir: Path
    media_library_dir: Path
    dedupe_index_path: Path
    library_db_path: Path
    library_covers_dir: Path
    fonts_dir: Path
    allowed_origin: str | None
    allowed_video_extensions: set[str]
    allowed_subtitle_extensions: set[str]
    port: int
    jimaku_api_token: str
    anki_highlight_auto_refresh: str
    anki_highlight_auto_refresh_hour: int
    anki_highlight_auto_refresh_minute: int


def _required_path_env(name: str, message: str) -> Path:
    raw_value = os.getenv(name)
    if not raw_value:
        raise RuntimeError(message)
    return Path(raw_value).expanduser().resolve()


def load_settings() -> Settings:
    project_dir = Path(__file__).resolve().parent.parent
    load_env_file(project_dir / ".env")

    base_dir = Path(os.getenv("PLAYER_SERVER_BASE_DIR", str(project_dir))).resolve()
    data_dir = Path(os.getenv("PLAYER_SERVER_DATA_DIR", str(base_dir / "data"))).resolve()
    frontend_dir = base_dir / "frontend"

    anki_media_dir = _required_path_env(
        "ANKI_MEDIA_DIR",
        "ANKI_MEDIA_DIR is not set. Create .env from .env.example and set your Anki collection.media path.",
    )
    media_library_dir = _required_path_env(
        "MEDIA_LIBRARY_DIR",
        "MEDIA_LIBRARY_DIR is not set. Add MEDIA_LIBRARY_DIR to .env, for example: MEDIA_LIBRARY_DIR=D:\\Anime",
    )

    return Settings(
        project_dir=project_dir,
        base_dir=base_dir,
        data_dir=data_dir,
        frontend_dir=frontend_dir,
        video_dir=data_dir / "UploadedVideos",
        anki_highlight_dir=data_dir / "anki_highlight",
        anki_media_dir=anki_media_dir,
        screenshot_dir=anki_media_dir,
        audio_dir=anki_media_dir,
        media_library_dir=media_library_dir,
        dedupe_index_path=data_dir / "dedupe_index.json",
        library_db_path=data_dir / "library.sqlite3",
        library_covers_dir=data_dir / "LibraryCovers",
        fonts_dir=frontend_dir / "fonts",
        allowed_origin=os.getenv("ALLOWED_ORIGIN"),
        allowed_video_extensions={".mp4", ".mkv", ".avi", ".mov", ".webm"},
        allowed_subtitle_extensions={".srt", ".ass", ".vtt"},
        port=int(os.getenv("PORT", "5000")),
        jimaku_api_token=os.getenv("JIMAKU_API_TOKEN", "").strip(),
        anki_highlight_auto_refresh=os.getenv("ANKI_HIGHLIGHT_AUTO_REFRESH", "daily").strip().lower(),
        anki_highlight_auto_refresh_hour=int(os.getenv("ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR", "4")),
        anki_highlight_auto_refresh_minute=int(os.getenv("ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE", "0")),
    )
