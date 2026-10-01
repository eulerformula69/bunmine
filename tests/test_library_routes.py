from dataclasses import replace

from flask import Flask

from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db
from backend.repositories.library_repository import refresh_library_file_existence
from backend.routes.library import (
    cover_routes,
    episode_routes,
    file_routes,
    series_routes,
    subtitle_routes,
)


def make_client(tmp_path, temporary_settings):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    media_root.mkdir()
    init_library_db(db_path)

    app = Flask(__name__)
    app.config["SETTINGS"] = replace(
        temporary_settings,
        library_db_path=db_path,
        media_library_dir=media_root,
        allowed_video_extensions={".mkv"},
        allowed_subtitle_extensions={".srt"},
    )
    app.register_blueprint(series_routes.library_series_bp)
    app.register_blueprint(episode_routes.library_episode_bp)
    app.register_blueprint(subtitle_routes.library_subtitle_bp)
    app.register_blueprint(cover_routes.library_cover_bp)
    app.register_blueprint(file_routes.library_file_bp)
    return app.test_client(), db_path, media_root


def test_get_does_not_refresh_missing_files(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
    _, _, _, video_path = seed_playable_episode(db_path, media_root)
    video_path.unlink()
    assert client.get("/library/series").json["series"][0]["episodesWithVideo"] == 1
    response = client.post("/library/refresh-files")
    assert response.status_code == 200
    assert response.json["markedMissing"] == 1
    assert client.get("/library/series").json["series"][0]["episodesWithVideo"] == 0


def test_refresh_handles_more_than_one_batch(tmp_path, temporary_settings):
    _, db_path, _ = make_client(tmp_path, temporary_settings)
    with get_db(db_path) as conn:
        conn.executemany(
            "INSERT INTO library_files(file_type, path, relative_path) VALUES('video', ?, ?)",
            [(str(tmp_path / f"missing-{index}.mkv"), f"{index}.mkv") for index in range(1201)],
        )
    assert refresh_library_file_existence(db_path) == {"checked": 1201, "markedMissing": 1201}


def test_kitsu_cover_can_be_selected(tmp_path, monkeypatch, temporary_settings):
    client, _, _ = make_client(tmp_path, temporary_settings)
    saved = {}

    def save(**kwargs):
        saved.update(kwargs)
        return {"found": True, "coverFileId": 42}

    monkeypatch.setattr(cover_routes, "save_series_cover", save)
    response = client.post("/library/series/1/cover/select", json={
        "source": "kitsu", "externalId": "1555",
        "coverUrl": "https://media.kitsu.app/anime/poster_images/1555/large.jpg",
    })
    assert response.status_code == 200
    assert response.get_json()["coverFileId"] == 42
    assert saved["source"] == "kitsu"


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


def test_library_series_endpoint_returns_normalized_ok_payload(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
    seed_playable_episode(db_path, media_root)

    response = client.get("/library/series")
    data = response.get_json()

    assert response.status_code == 200
    assert data["series"][0]["title"] == "Show"
    assert data["series"][0]["linkStatus"] == "partial"


def test_library_episode_playback_returns_urls_for_existing_video(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
    _, episode_id, file_id, _ = seed_playable_episode(db_path, media_root)

    response = client.get(f"/library/episodes/{episode_id}/playback")
    data = response.get_json()

    assert response.status_code == 200
    assert data["episodeId"] == episode_id
    assert data["videoFileId"] == file_id
    assert data["videoUrl"] == f"/library/file/{file_id}"
    assert data["subtitleUrl"] is None


def test_library_episode_playback_404_for_unknown_episode(tmp_path, temporary_settings):
    client, *_ = make_client(tmp_path, temporary_settings)

    response = client.get("/library/episodes/999/playback")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Episode not found"


def test_delete_missing_library_episode_removes_db_entry_and_preserves_card(tmp_path, temporary_settings):
    client, db_path, _ = make_client(tmp_path, temporary_settings)
    with get_db(db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title) VALUES(?, ?)",
            ("Show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            "INSERT INTO episodes(series_id, normalized_key, title) VALUES(?, ?, ?)",
            (series_id, "show|unknown", "Episode Unknown"),
        ).lastrowid
        conn.execute(
            "INSERT INTO watch_progress(episode_id, completed) VALUES(?, 1)",
            (episode_id,),
        )
        conn.execute(
            "INSERT INTO cards(series_id, episode_id, note_id) VALUES(?, ?, ?)",
            (series_id, episode_id, "note-1"),
        )

    response = client.delete(f"/library/episodes/{episode_id}")

    assert response.status_code == 200
    assert response.get_json()["episodeId"] == episode_id
    with get_db(db_path) as conn:
        assert conn.execute("SELECT 1 FROM episodes WHERE id = ?", (episode_id,)).fetchone() is None
        assert conn.execute("SELECT 1 FROM watch_progress WHERE episode_id = ?", (episode_id,)).fetchone() is None
        card = conn.execute("SELECT series_id, episode_id FROM cards WHERE note_id = 'note-1'").fetchone()
        assert card["series_id"] == series_id
        assert card["episode_id"] is None


def test_delete_library_episode_rejects_episode_with_existing_media(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
    _, episode_id, _, _ = seed_playable_episode(db_path, media_root)

    response = client.delete(f"/library/episodes/{episode_id}")

    assert response.status_code == 409
    assert response.get_json()["error"] == "Episode still has existing media files"
    with get_db(db_path) as conn:
        assert conn.execute("SELECT 1 FROM episodes WHERE id = ?", (episode_id,)).fetchone() is not None


def test_serve_library_file_rejects_paths_outside_media_root(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
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


def test_serve_library_ass_file_preserves_original_source(tmp_path, temporary_settings):
    client, db_path, media_root = make_client(tmp_path, temporary_settings)
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


def test_library_scan_path_rejects_directory_outside_media_root(tmp_path, temporary_settings):
    client, *_ = make_client(tmp_path, temporary_settings)
    outside_dir = tmp_path / "outside-dir"
    outside_dir.mkdir()

    response = client.post("/library/scan-path", json={"path": str(outside_dir)})

    assert response.status_code == 403
    assert response.get_json()["error"] == "Path must be inside MEDIA_LIBRARY_DIR"
