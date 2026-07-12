import sqlite3

from backend.library_db import init_library_db
from backend.library_scanner import detect_episode, infer_series_title, scan_library


def test_scan_library_links_video_and_subtitle(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    series_dir = media_root / "Example Show"
    series_dir.mkdir(parents=True)
    (series_dir / "Example Show - 01.mkv").write_bytes(b"video")
    (series_dir / "Example Show - 01.srt").write_text("1\n00:00:00,000 --> 00:00:01,000\ntext\n", encoding="utf-8")

    init_library_db(db_path)
    result = scan_library(db_path, media_root, {".mkv"}, {".srt"})

    assert result["ok"] is True
    assert result["filesFound"] == 2
    assert result["seriesTouched"] == 1
    assert result["episodesTouched"] == 1
    assert result["videoFiles"] == 1
    assert result["subtitleFiles"] == 1

    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM series").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM library_files").fetchone()[0] == 2


def test_scan_library_marks_missing_files_on_rescan(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    series_dir = media_root / "Example Show"
    series_dir.mkdir(parents=True)
    video_path = series_dir / "Example Show - 01.mkv"
    video_path.write_bytes(b"video")

    init_library_db(db_path)
    scan_library(db_path, media_root, {".mkv"}, {".srt"})
    video_path.unlink()
    result = scan_library(db_path, media_root, {".mkv"}, {".srt"})

    assert result["ok"] is True
    assert result["missingFilesMarked"] == 1

    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT file_exists FROM library_files").fetchone()[0] == 0


def test_scan_library_is_idempotent(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    series_dir = media_root / "Example Show"
    series_dir.mkdir(parents=True)
    (series_dir / "Example Show S01E02.mkv").write_bytes(b"video")
    (series_dir / "Example Show S01E02.srt").write_text("sub", encoding="utf-8")

    init_library_db(db_path)
    first = scan_library(db_path, media_root, {".mkv"}, {".srt"})
    second = scan_library(db_path, media_root, {".mkv"}, {".srt"})

    assert first["ok"] is True
    assert second["ok"] is True

    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM series").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM library_files").fetchone()[0] == 2


def test_detect_episode_common_anime_filename_forms(tmp_path):
    assert detect_episode(tmp_path / "Show S02E003.mkv") == (2, 3.0)
    assert detect_episode(tmp_path / "[Group] Show [07v2].mkv") == (None, 7.0)
    assert detect_episode(tmp_path / "Show - Episode 12.ass") == (None, 12.0)
    assert detect_episode(tmp_path / "Show Special.mkv") == (None, None)


def test_infer_series_title_uses_nearest_meaningful_folder(tmp_path):
    media_root = tmp_path / "media"
    episode_path = media_root / "anime" / "Example Show (BDRip)" / "Example Show - 01.mkv"
    episode_path.parent.mkdir(parents=True)
    episode_path.write_bytes(b"video")

    assert infer_series_title(media_root, episode_path) == "Example Show"
