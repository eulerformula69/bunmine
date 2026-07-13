from pathlib import Path

from backend.library_db import get_db, refresh_library_file_existence


def delete_library_series(db_path: Path, series_id: int) -> dict:
    """Remove a series from the library DB without deleting media on disk."""
    with get_db(db_path) as conn:
        series = conn.execute(
            "SELECT id, title, cover_file_id FROM series WHERE id = ?",
            (series_id,),
        ).fetchone()
        if not series:
            return {"found": False}

        episode_rows = conn.execute(
            "SELECT id FROM episodes WHERE series_id = ?",
            (series_id,),
        ).fetchall()
        episode_ids = [int(row["id"]) for row in episode_rows]
        file_count = conn.execute(
            "SELECT COUNT(*) AS count FROM library_files WHERE series_id = ?",
            (series_id,),
        ).fetchone()["count"]

        if episode_ids:
            placeholders = ", ".join("?" for _ in episode_ids)
            conn.execute(
                f"DELETE FROM watch_progress WHERE episode_id IN ({placeholders})",
                tuple(episode_ids),
            )
            conn.execute(
                f"DELETE FROM cards WHERE episode_id IN ({placeholders})",
                tuple(episode_ids),
            )
            conn.execute(
                f"DELETE FROM library_files WHERE episode_id IN ({placeholders})",
                tuple(episode_ids),
            )

        conn.execute("DELETE FROM cards WHERE series_id = ?", (series_id,))
        conn.execute("DELETE FROM library_files WHERE series_id = ?", (series_id,))
        conn.execute("DELETE FROM episodes WHERE series_id = ?", (series_id,))
        conn.execute("DELETE FROM series WHERE id = ?", (series_id,))

        return {
            "found": True,
            "seriesId": series_id,
            "title": series["title"],
            "episodesDeleted": len(episode_ids),
            "filesDeleted": int(file_count or 0),
        }


def delete_missing_library_episode(db_path: Path, episode_id: int) -> dict:
    """Remove an episode that has no existing media files from the library DB."""
    refresh_library_file_existence(db_path, {"video", "subtitle"})

    with get_db(db_path) as conn:
        episode = conn.execute(
            """
            SELECT e.id, e.series_id, e.title,
                   EXISTS (
                       SELECT 1
                       FROM library_files lf
                       WHERE lf.episode_id = e.id AND lf.file_exists = 1
                   ) AS has_existing_files
            FROM episodes e
            WHERE e.id = ?
            """,
            (episode_id,),
        ).fetchone()
        if not episode:
            return {"found": False}
        if episode["has_existing_files"]:
            return {"found": True, "deleted": False, "reason": "existing_files"}

        stale_files = conn.execute(
            "SELECT COUNT(*) AS count FROM library_files WHERE episode_id = ?",
            (episode_id,),
        ).fetchone()["count"]

        conn.execute("DELETE FROM watch_progress WHERE episode_id = ?", (episode_id,))
        conn.execute("UPDATE cards SET episode_id = NULL WHERE episode_id = ?", (episode_id,))
        conn.execute("DELETE FROM library_files WHERE episode_id = ?", (episode_id,))
        conn.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))

        return {
            "found": True,
            "deleted": True,
            "episodeId": episode_id,
            "seriesId": int(episode["series_id"]),
            "title": episode["title"],
            "staleFilesDeleted": int(stale_files or 0),
        }
