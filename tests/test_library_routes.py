from flask import Flask

from backend.library_db import get_db, init_library_db
from backend.routes import library_routes


def make_client(tmp_path, monkeypatch):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    media_root.mkdir()
    init_library_db(db_path)

    monkeypatch.setattr(library_routes, "LIBRARY_DB_PATH", db_path)
    monkeypatch.setattr(library_routes, "MEDIA_LIBRARY_DIR", media_root)
    monkeypatch.setattr(library_routes, "ALLOWED_VIDEO_EXTENSIONS", {".mkv"})
    monkeypatch.setattr(library_routes, "ALLOWED_SUBTITLE_EXTENSIONS", {".srt"})

    app = Flask(__name__)
    app.register_blueprint(library_routes.library_bp)
    return app.test_client(), db_path, media_root


def seed_playable_episode(db_path, media_root):
    video_path = media_root / "Show" / "Show - 01.mkv"
    video_path.parent.mkdir(parents=True)
    video_path.write_bytes(b"video")
    with get_db(db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title, sort_title) VALUES(?, ?, ?)",
            ("Show", "show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            "INSERT INTO episodes(series_id, normalized_key, title) VALUES(?, ?, ?)",
            (series_id, "show|s1|e1", "Episode 01"),
        ).lastrowid
        file_id = conn.execute(
            """
            INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary)
            VALUES(?, ?, 'video', ?, ?, 1, 1)
            """,
            (series_id, episode_id, str(video_path), str(video_path.relative_to(media_root))),
        ).lastrowid
    return series_id, episode_id, file_id, video_path


def test_library_series_endpoint_returns_normalized_ok_payload(tmp_path, monkeypatch):
    client, db_path, media_root = make_client(tmp_path, monkeypatch)
    seed_playable_episode(db_path, media_root)

    response = client.get("/library/series")
    data = response.get_json()

    assert response.status_code == 200
    assert data["series"][0]["title"] == "Show"
    assert data["series"][0]["linkStatus"] == "partial"


def test_library_episode_playback_returns_urls_for_existing_video(tmp_path, monkeypatch):
    client, db_path, media_root = make_client(tmp_path, monkeypatch)
    _, episode_id, file_id, _ = seed_playable_episode(db_path, media_root)

    response = client.get(f"/library/episodes/{episode_id}/playback")
    data = response.get_json()

    assert response.status_code == 200
    assert data["episodeId"] == episode_id
    assert data["videoFileId"] == file_id
    assert data["videoUrl"] == f"/library/file/{file_id}"
    assert data["subtitleUrl"] is None


def test_library_episode_playback_404_for_unknown_episode(tmp_path, monkeypatch):
    client, *_ = make_client(tmp_path, monkeypatch)

    response = client.get("/library/episodes/999/playback")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Episode not found"


def test_serve_library_file_rejects_paths_outside_media_root(tmp_path, monkeypatch):
    client, db_path, media_root = make_client(tmp_path, monkeypatch)
    outside_file = tmp_path / "outside.mkv"
    outside_file.write_bytes(b"video")

    with get_db(db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title) VALUES(?, ?)",
            ("Show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            "INSERT INTO episodes(series_id, normalized_key) VALUES(?, ?)",
            (series_id, "show|s1|e1"),
        ).lastrowid
        file_id = conn.execute(
            """
            INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary)
            VALUES(?, ?, 'video', ?, ?, 1, 1)
            """,
            (series_id, episode_id, str(outside_file), "outside.mkv"),
        ).lastrowid

    response = client.get(f"/library/file/{file_id}")

    assert response.status_code == 403
    assert response.get_json()["error"] == "File is outside MEDIA_LIBRARY_DIR"


def test_serve_library_ass_file_preserves_original_source(tmp_path, monkeypatch):
    client, db_path, media_root = make_client(tmp_path, monkeypatch)
    series_id, episode_id, _, _ = seed_playable_episode(db_path, media_root)
    source = "[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{3\\pos(960,12)}字幕\n"
    subtitle_path = media_root / "Show" / "Show - 01.ass"
    subtitle_path.write_text(source, encoding="utf-8")

    with get_db(db_path) as conn:
        file_id = conn.execute(
            """
            INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary)
            VALUES(?, ?, 'subtitle', ?, ?, 1, 1)
            """,
            (series_id, episode_id, str(subtitle_path), str(subtitle_path.relative_to(media_root))),
        ).lastrowid

    response = client.get(f"/library/file/{file_id}")

    assert response.status_code == 200
    assert response.data == subtitle_path.read_bytes()


def test_library_scan_path_rejects_directory_outside_media_root(tmp_path, monkeypatch):
    client, *_ = make_client(tmp_path, monkeypatch)
    outside_dir = tmp_path / "outside-dir"
    outside_dir.mkdir()

    response = client.post("/library/scan-path", json={"path": str(outside_dir)})

    assert response.status_code == 403
    assert response.get_json()["error"] == "Path must be inside MEDIA_LIBRARY_DIR"
