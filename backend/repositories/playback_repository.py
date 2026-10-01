from pathlib import Path

from backend.repositories.connection import get_db
from backend.repositories.episode_file_query import primary_file_id_sql


def get_library_file_by_id(db_path: Path, file_id: int) -> dict:
    with get_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT id, series_id, episode_id, file_type, path, relative_path, file_exists, is_primary
            FROM library_files
            WHERE id = ?
            """,
            (file_id,),
        ).fetchone()
        return {"found": bool(row), "file": dict(row) if row else None}


def get_episode_playback(db_path: Path, episode_id: int) -> dict:
    with get_db(db_path) as conn:
        row = conn.execute(
            f"""
            SELECT e.id AS episode_id, e.title AS episode_title, e.duration_seconds,
                   s.id AS series_id, s.title AS series_title,
                   COALESCE(wp.current_time_seconds, 0) AS current_time_seconds,
                   ({primary_file_id_sql("video")}) AS video_file_id,
                   ({primary_file_id_sql("subtitle")}) AS subtitle_file_id
            FROM episodes e
            JOIN series s ON s.id = e.series_id
            LEFT JOIN watch_progress wp ON wp.episode_id = e.id
            WHERE e.id = ?
            """,
            (episode_id,),
        ).fetchone()
        if not row:
            return {"found": False, "playback": None}
        if not row["video_file_id"]:
            return {"found": True, "playback": None, "error": "Video file is missing for this episode"}

        subtitle_file_id = row["subtitle_file_id"]
        return {
            "found": True,
            "playback": {
                "episodeId": row["episode_id"],
                "seriesId": row["series_id"],
                "seriesTitle": row["series_title"],
                "episodeTitle": row["episode_title"],
                "durationSeconds": row["duration_seconds"],
                "currentTimeSeconds": float(row["current_time_seconds"] or 0),
                "videoFileId": row["video_file_id"],
                "subtitleFileId": subtitle_file_id,
                "videoUrl": f"/library/file/{row['video_file_id']}",
                "subtitleUrl": f"/library/file/{subtitle_file_id}" if subtitle_file_id else None,
            },
        }


def save_episode_progress(
    db_path: Path,
    episode_id: int,
    current_time_seconds: float,
    duration_seconds: float | None,
    watched_delta_seconds: float,
    completed: bool,
) -> dict:
    current_time_seconds = max(0.0, float(current_time_seconds or 0))
    watched_delta_seconds = max(0.0, float(watched_delta_seconds or 0))
    duration_seconds = None if duration_seconds is None else max(0.0, float(duration_seconds or 0))
    with get_db(db_path) as conn:
        if not conn.execute("SELECT id FROM episodes WHERE id = ?", (episode_id,)).fetchone():
            return {"found": False, "progress": None}
        conn.execute(
            """
            INSERT INTO watch_progress(
                episode_id, current_time_seconds, duration_seconds, watched_seconds, completed, last_watched_at
            )
            VALUES(?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(episode_id) DO UPDATE SET
                current_time_seconds = excluded.current_time_seconds,
                duration_seconds = COALESCE(excluded.duration_seconds, watch_progress.duration_seconds),
                watched_seconds = watch_progress.watched_seconds + excluded.watched_seconds,
                completed = CASE WHEN excluded.completed = 1 THEN 1 ELSE watch_progress.completed END,
                last_watched_at = CURRENT_TIMESTAMP
            """,
            (episode_id, current_time_seconds, duration_seconds, watched_delta_seconds, int(completed)),
        )
        row = conn.execute(
            "SELECT episode_id, current_time_seconds, duration_seconds, watched_seconds, completed, last_watched_at "
            "FROM watch_progress WHERE episode_id = ?",
            (episode_id,),
        ).fetchone()
        return {"found": True, "progress": dict(row)}


def set_episode_completed(db_path: Path, episode_id: int, completed: bool) -> dict:
    with get_db(db_path) as conn:
        episode = conn.execute("SELECT id, duration_seconds FROM episodes WHERE id = ?", (episode_id,)).fetchone()
        if not episode:
            return {"found": False, "progress": None}
        conn.execute(
            """
            INSERT INTO watch_progress(
                episode_id, current_time_seconds, duration_seconds, watched_seconds, completed, last_watched_at
            )
            VALUES(?, 0, ?, 0, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(episode_id) DO UPDATE SET completed = excluded.completed, last_watched_at = CURRENT_TIMESTAMP
            """,
            (episode_id, episode["duration_seconds"], int(completed)),
        )
        row = conn.execute(
            "SELECT episode_id, current_time_seconds, duration_seconds, watched_seconds, completed, last_watched_at "
            "FROM watch_progress WHERE episode_id = ?",
            (episode_id,),
        ).fetchone()
        return {"found": True, "progress": dict(row)}
