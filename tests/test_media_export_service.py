import subprocess
from pathlib import Path

from backend.library_db import get_db, init_library_db
from backend.services import media_export_service
from backend.services.media_export_service import (
    MediaExportError,
    create_animated_webp,
    create_audio_clip,
    create_track_url,
    get_audio_tracks,
)
from backend.settings import Settings


def make_settings(tmp_path: Path) -> Settings:
    data_dir = tmp_path / "data"
    video_dir = data_dir / "UploadedVideos"
    anki_media_dir = tmp_path / "anki-media"
    media_library_dir = tmp_path / "media-library"
    for path in [video_dir, anki_media_dir, media_library_dir, data_dir / "LibraryCovers", tmp_path / "frontend" / "fonts"]:
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


def test_create_audio_clip_builds_ffmpeg_command_and_saves_dedupe(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    video_path = settings.video_dir / "clip.mkv"
    video_path.write_bytes(b"video")
    calls = []
    saved = []

    monkeypatch.setattr(media_export_service, "get_cached_media", lambda kind, key: None)
    monkeypatch.setattr(media_export_service, "save_cached_media", lambda kind, key, filename: saved.append((kind, key, filename)))
    monkeypatch.setattr(media_export_service, "run_subprocess", lambda cmd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0))

    result = create_audio_clip(settings, {
        "filename": "clip.mkv",
        "start": 1.23456,
        "end": 2.5,
        "trackIndex": "a:1",
        "volume": "1.5",
    })

    assert result["reused"] is False
    assert result["filename"].startswith("audio_")
    assert result["filename"].endswith(".mp3")
    assert calls[0][:3] == ["ffmpeg", "-y", "-i"]
    assert calls[0][calls[0].index("-map") + 1] == "0:a:1"
    assert calls[0][calls[0].index("-af") + 1] == "volume=1.5"
    assert saved[0][0] == "audio"


def test_create_audio_clip_reuses_existing_dedupe_without_ffmpeg(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    (settings.video_dir / "clip.mkv").write_bytes(b"video")
    monkeypatch.setattr(media_export_service, "get_cached_media", lambda kind, key: "audio_cached.mp3")
    monkeypatch.setattr(media_export_service, "run_subprocess", lambda cmd: (_ for _ in ()).throw(AssertionError("ffmpeg should not run")))

    result = create_audio_clip(settings, {"filename": "clip.mkv", "start": 1, "end": 2})

    assert result == {
        "filename": "audio_cached.mp3",
        "url": "/get-temp-audio?filename=audio_cached.mp3",
        "reused": True,
    }


def test_create_audio_clip_rejects_missing_time_range(tmp_path):
    settings = make_settings(tmp_path)

    try:
        create_audio_clip(settings, {"filename": "clip.mkv", "start": 1})
    except ValueError as err:
        assert "start and end are required" in str(err)
    else:
        raise AssertionError("expected ValueError")


def test_get_audio_tracks_parses_ffprobe_json(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    (settings.video_dir / "clip.mkv").write_bytes(b"video")

    def fake_run(cmd):
        return subprocess.CompletedProcess(cmd, 0, stdout='{"streams":[{"index":1,"tags":{"language":"jpn"}}]}')

    monkeypatch.setattr(media_export_service, "run_subprocess", fake_run)

    assert get_audio_tracks(settings, None, "clip.mkv") == {
        "tracks": [{"index": 1, "tags": {"language": "jpn"}}]
    }


def test_create_track_url_rejects_non_video_library_file(tmp_path):
    settings = make_settings(tmp_path)
    init_library_db(settings.library_db_path)
    with get_db(settings.library_db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title) VALUES(?, ?)",
            ("Show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            "INSERT INTO episodes(series_id, normalized_key) VALUES(?, ?)",
            (series_id, "show|s1|e1"),
        ).lastrowid
        subtitle_id = conn.execute(
            """
            INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path)
            VALUES(?, ?, 'subtitle', ?, ?)
            """,
            (series_id, episode_id, str(settings.media_library_dir / "Show.srt"), "Show.srt"),
        ).lastrowid

    try:
        create_track_url(settings, {"videoFileId": subtitle_id, "trackIndex": "a:0"})
    except MediaExportError as err:
        assert err.status_code == 400
        assert "not a video" in str(err)
    else:
        raise AssertionError("expected MediaExportError")


def test_create_animated_webp_clamps_duration_and_cleans_temp_ass(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    (settings.video_dir / "clip.mkv").write_bytes(b"video")
    calls = []
    monkeypatch.setattr(media_export_service, "get_cached_media", lambda kind, key: None)
    monkeypatch.setattr(media_export_service, "save_cached_media", lambda kind, key, filename: None)
    monkeypatch.setattr(media_export_service, "run_subprocess", lambda cmd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0))

    result = create_animated_webp(settings, {"filename": "clip.mkv", "start": 10, "end": 30, "text": "hello"})

    assert result["reused"] is False
    assert result["filename"].endswith(".webp")
    assert calls[0][calls[0].index("-t") + 1] == "8.0"
    assert not list(settings.video_dir.glob("temp_*.ass"))
