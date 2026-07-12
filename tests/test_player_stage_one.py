import subprocess
from pathlib import Path

from backend.services import media_export_service
from backend.services.media_export_service import create_track_url
from backend.settings import Settings


def make_settings(tmp_path: Path) -> Settings:
    data_dir = tmp_path / "data"
    video_dir = data_dir / "UploadedVideos"
    anki_media_dir = tmp_path / "anki-media"
    media_library_dir = tmp_path / "media-library"
    for path in (video_dir, anki_media_dir, media_library_dir):
        path.mkdir(parents=True, exist_ok=True)
    return Settings(
        project_dir=tmp_path,
        base_dir=tmp_path,
        data_dir=data_dir,
        frontend_dir=tmp_path / "frontend",
        video_dir=video_dir,
        anki_highlight_dir=data_dir / "anki_highlight",
        anki_media_dir=anki_media_dir,
        screenshot_dir=anki_media_dir,
        audio_dir=anki_media_dir,
        media_library_dir=media_library_dir,
        dedupe_index_path=data_dir / "dedupe_index.json",
        library_db_path=data_dir / "library.sqlite3",
        library_covers_dir=data_dir / "LibraryCovers",
        fonts_dir=tmp_path / "frontend" / "fonts",
        allowed_origin=None,
        allowed_video_extensions={".mp4", ".mkv"},
        allowed_subtitle_extensions={".srt", ".ass", ".vtt"},
        port=5000,
        jimaku_api_token="",
        anki_highlight_auto_refresh="never",
        anki_highlight_auto_refresh_hour=4,
        anki_highlight_auto_refresh_minute=0,
    )


def test_selected_audio_is_remuxed_into_single_video_stream(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    (settings.video_dir / "episode.mkv").write_bytes(b"video")
    calls = []
    monkeypatch.setattr(
        media_export_service,
        "run_subprocess",
        lambda cmd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0),
    )

    result = create_track_url(settings, {"filename": "episode.mkv", "trackIndex": "2"})

    command = calls[0]
    assert command[command.index("-map") + 1] == "0:v:0"
    second_map = command.index("-map", command.index("-map") + 1)
    assert command[second_map + 1] == "0:2"
    assert command[command.index("-c:v") + 1] == "copy"
    assert command[command.index("-c:a") + 1] == "aac"
    assert result["url"].startswith("/player-cache/track_")
    assert result["url"].endswith(".mp4")
