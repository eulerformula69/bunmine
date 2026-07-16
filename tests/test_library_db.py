from backend.library_db import (
    delete_library_series,
    get_db,
    get_library_series_detail,
    get_library_series_list,
    init_library_db,
    relink_library_series_files,
    save_episode_progress,
    set_episode_completed,
)


def seed_series_with_episode(db_path, media_root, *, with_subtitle=True):
    video_path = media_root / "Show" / "Show - 01.mkv"
    subtitle_path = media_root / "Show" / "Show - 01.srt"
    video_path.parent.mkdir(parents=True, exist_ok=True)
    video_path.write_bytes(b"video")
    if with_subtitle:
        subtitle_path.write_text("subtitle", encoding="utf-8")

    with get_db(db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title, sort_title) VALUES(?, ?, ?)",
            ("Show", "show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            """
            INSERT INTO episodes(series_id, normalized_key, title, episode_number, season_number, duration_seconds)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (series_id, "show|s1|e1", "Episode 01", 1.0, 1, 120.0),
        ).lastrowid
        conn.execute(
            """
            INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary)
            VALUES(?, ?, 'video', ?, ?, 1, 1)
            """,
            (series_id, episode_id, str(video_path), str(video_path.relative_to(media_root))),
        )
        if with_subtitle:
            conn.execute(
                """
                INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary)
                VALUES(?, ?, 'subtitle', ?, ?, 1, 1)
                """,
                (series_id, episode_id, str(subtitle_path), str(subtitle_path.relative_to(media_root))),
            )
    return series_id, episode_id, video_path, subtitle_path


def test_save_episode_progress_accumulates_watched_seconds(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    init_library_db(db_path)

    with get_db(db_path) as conn:
        series_id = conn.execute(
            "INSERT INTO series(title, normalized_title) VALUES(?, ?)",
            ("Show", "show"),
        ).lastrowid
        episode_id = conn.execute(
            "INSERT INTO episodes(series_id, normalized_key, title) VALUES(?, ?, ?)",
            (series_id, "show|s1|e1", "Episode 01"),
        ).lastrowid

    first = save_episode_progress(db_path, episode_id, 10, 120, 5, False)
    second = save_episode_progress(db_path, episode_id, 20, 120, 7, True)

    assert first["found"] is True
    assert second["progress"]["current_time_seconds"] == 20
    assert second["progress"]["watched_seconds"] == 12
    assert second["progress"]["completed"] == 1


def test_library_series_list_and_detail_report_link_status_and_counts(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    init_library_db(db_path)
    series_id, episode_id, *_ = seed_series_with_episode(db_path, media_root)
    save_episode_progress(db_path, episode_id, 30, 120, 30, True)

    with get_db(db_path) as conn:
        conn.execute(
            "INSERT INTO cards(series_id, episode_id, note_id, word, sentence) VALUES(?, ?, ?, ?, ?)",
            (series_id, episode_id, "note-1", "言葉", "言葉です"),
        )

    series = get_library_series_list(db_path)[0]
    detail = get_library_series_detail(db_path, series_id)

    assert series["linkStatus"] == "linked"
    assert series["episodesCount"] == 1
    assert series["completedEpisodes"] == 1
    assert series["cardsCount"] == 1
    assert series["minedWordsCount"] == 1
    assert series["lastWatchedAt"] is not None
    assert series["currentTimeSeconds"] == 0
    assert detail["series"]["linkStatus"] == "linked"
    assert detail["episodes"][0]["linkStatus"] == "linked"
    assert detail["episodes"][0]["videoFilename"].endswith("Show - 01.mkv")


def test_library_series_detail_marks_partial_when_subtitle_is_missing(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    init_library_db(db_path)
    series_id, *_ = seed_series_with_episode(db_path, media_root, with_subtitle=False)

    detail = get_library_series_detail(db_path, series_id)

    assert detail["series"]["linkStatus"] == "partial"
    assert detail["episodes"][0]["hasVideo"] is True
    assert detail["episodes"][0]["hasSubtitle"] is False
    assert detail["episodes"][0]["linkStatus"] == "partial"


def test_delete_library_series_removes_db_rows_but_keeps_media_files(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    init_library_db(db_path)
    series_id, episode_id, video_path, subtitle_path = seed_series_with_episode(db_path, media_root)
    save_episode_progress(db_path, episode_id, 30, 120, 30, True)

    result = delete_library_series(db_path, series_id)

    assert result["found"] is True
    assert result["episodesDeleted"] == 1
    assert result["filesDeleted"] == 2
    assert video_path.exists()
    assert subtitle_path.exists()
    with get_db(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM series").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM library_files").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM watch_progress").fetchone()[0] == 0


def test_relink_library_series_files_restores_missing_video_path(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    init_library_db(db_path)
    series_id, _, old_video_path, _ = seed_series_with_episode(db_path, media_root, with_subtitle=False)
    new_base = tmp_path / "new-media" / "Show"
    new_video_path = new_base / old_video_path.name
    new_base.mkdir(parents=True)
    old_video_path.replace(new_video_path)

    result = relink_library_series_files(db_path, series_id, new_base, media_root)

    assert result["found"] is True
    assert len(result["relinked"]) == 1
    assert result["unresolved"] == []
    with get_db(db_path) as conn:
        row = conn.execute("SELECT path, file_exists FROM library_files WHERE file_type = 'video'").fetchone()
    assert row["path"] == str(new_video_path.resolve())
    assert row["file_exists"] == 1


def test_set_episode_completed_can_toggle_completion(tmp_path):
    db_path = tmp_path / "library.sqlite3"
    media_root = tmp_path / "media"
    init_library_db(db_path)
    _, episode_id, *_ = seed_series_with_episode(db_path, media_root, with_subtitle=False)

    completed = set_episode_completed(db_path, episode_id, True)
    not_completed = set_episode_completed(db_path, episode_id, False)

    assert completed["progress"]["completed"] == 1
    assert not_completed["progress"]["completed"] == 0
