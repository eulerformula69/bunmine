"""Library repository functions for direct database access.

This module contains SQL queries and simple data access functions.
Business logic belongs in backend/services/library_service.py.
"""

from pathlib import Path

from backend.repositories.connection import get_db
from backend.repositories.episode_file_query import primary_file_id_sql


def init_library_db(db_path: Path) -> None:
    """Initialize the library database schema."""
    from backend.migrations.runner import run_migrations

    db_path.parent.mkdir(parents=True, exist_ok=True)
    run_migrations(db_path)


def get_library_db_status(db_path: Path) -> dict:
    """Get database status information."""
    exists = db_path.exists()
    status = {"path": str(db_path), "exists": exists, "schemaVersion": None, "tables": {}}
    if not exists:
        return status

    with get_db(db_path) as conn:
        row = conn.execute("SELECT value FROM schema_meta WHERE key = 'schema_version'").fetchone()
        if row:
            status["schemaVersion"] = row["value"]

        table_names = ["series", "episodes", "library_files", "watch_progress", "cards"]
        for table_name in table_names:
            count_row = conn.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
            status["tables"][table_name] = count_row["count"]
    return status


def refresh_library_file_existence(
    db_path: Path, file_types: list[str] | tuple[str, ...] | set[str] | None = None
) -> dict:
    """Mark DB file records as missing when the file disappeared from disk."""
    filters = []
    params: list[object] = []
    if file_types:
        placeholders = ", ".join("?" for _ in file_types)
        filters.append(f"file_type IN ({placeholders})")
        params.extend(list(file_types))

    where = "WHERE file_exists = 1"
    if filters:
        where += " AND " + " AND ".join(filters)

    checked = 0
    marked_missing = 0
    missing_ids: list[int] = []

    with get_db(db_path) as conn:
        rows = conn.execute(
            f"SELECT id, path FROM library_files {where}",
            tuple(params),
        ).fetchall()

    for row in rows:
        checked += 1
        file_path = Path(row["path"]).expanduser()
        if file_path.is_file():
            continue
        missing_ids.append(int(row["id"]))

    with get_db(db_path) as conn:
        for offset in range(0, len(missing_ids), 500):
            batch = missing_ids[offset : offset + 500]
            placeholders = ", ".join("?" for _ in batch)
            conn.execute(
                f"""
                UPDATE library_files
                SET file_exists = 0,
                    missing_since = COALESCE(missing_since, CURRENT_TIMESTAMP),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id IN ({placeholders})
                """,
                tuple(batch),
            )
            marked_missing = len(missing_ids)

    return {"checked": checked, "markedMissing": marked_missing}


def get_library_series_list(db_path: Path) -> list[dict]:
    """Get list of all series with aggregated statistics."""
    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            WITH episode_file_stats AS (
                SELECT
                    episode_id,
                    MAX(CASE WHEN file_type = 'video' AND file_exists = 1 THEN 1 ELSE 0 END) AS has_video,
                    MAX(CASE WHEN file_type = 'subtitle' AND file_exists = 1 THEN 1 ELSE 0 END) AS has_subtitle
                FROM library_files
                WHERE file_type IN ('video', 'subtitle')
                GROUP BY episode_id
            ),
            series_episode_stats AS (
                SELECT
                    e.series_id,
                    COUNT(e.id) AS episodes_count,
                    SUM(COALESCE(efs.has_video, 0)) AS episodes_with_video,
                    SUM(COALESCE(efs.has_subtitle, 0)) AS episodes_with_subtitle,
                    SUM(CASE WHEN wp.completed = 1 THEN 1 ELSE 0 END) AS completed_episodes,
                    SUM(CASE WHEN wp.current_time_seconds > 5 AND wp.completed = 0 THEN 1 ELSE 0 END)
                        AS in_progress_episodes,
                    SUM(COALESCE(wp.watched_seconds, 0)) AS watched_seconds,
                    MAX(CASE WHEN wp.completed = 0 THEN wp.current_time_seconds END) AS latest_current_time_seconds,
                    MAX(wp.last_watched_at) AS last_watched_at
                FROM episodes e
                LEFT JOIN episode_file_stats efs ON efs.episode_id = e.id
                LEFT JOIN watch_progress wp ON wp.episode_id = e.id
                GROUP BY e.series_id
            ),
            series_card_stats AS (
                SELECT
                    series_id,
                    COUNT(id) AS cards_count,
                    COUNT(DISTINCT CASE WHEN word IS NOT NULL AND TRIM(word) != '' THEN word END) AS mined_words_count
                FROM cards
                GROUP BY series_id
            )
            SELECT
                s.id,
                s.title,
                s.cover_file_id,
                COALESCE(ses.episodes_count, 0) AS episodes_count,
                COALESCE(ses.episodes_with_video, 0) AS episodes_with_video,
                COALESCE(ses.episodes_with_subtitle, 0) AS episodes_with_subtitle,
                COALESCE(ses.completed_episodes, 0) AS completed_episodes,
                COALESCE(ses.in_progress_episodes, 0) AS in_progress_episodes,
                COALESCE(ses.watched_seconds, 0) AS watched_seconds,
                ses.latest_current_time_seconds,
                ses.last_watched_at,
                s.created_at,
                COALESCE(scs.cards_count, 0) AS cards_count,
                COALESCE(scs.mined_words_count, 0) AS mined_words_count
            FROM series s
            LEFT JOIN series_episode_stats ses ON ses.series_id = s.id
            LEFT JOIN series_card_stats scs ON scs.series_id = s.id
            ORDER BY s.sort_title, s.title
            """
        ).fetchall()

        result = []
        for row in rows:
            episodes_count = int(row["episodes_count"])
            episodes_with_video = int(row["episodes_with_video"])
            episodes_with_subtitle = int(row["episodes_with_subtitle"])
            result.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "coverUrl": f"/library/cover/{row['id']}" if row["cover_file_id"] else None,
                    "episodesCount": episodes_count,
                    "episodesWithVideo": episodes_with_video,
                    "episodesWithSubtitle": episodes_with_subtitle,
                    "completedEpisodes": int(row["completed_episodes"]),
                    "inProgressEpisodes": int(row["in_progress_episodes"]),
                    "watchedSeconds": float(row["watched_seconds"] or 0),
                    "currentTimeSeconds": float(row["latest_current_time_seconds"] or 0),
                    "lastWatchedAt": row["last_watched_at"],
                    "createdAt": row["created_at"],
                    "cardsCount": int(row["cards_count"]),
                    "minedWordsCount": int(row["mined_words_count"]),
                    "linkStatus": _series_link_status(episodes_count, episodes_with_video, episodes_with_subtitle),
                }
            )
        return result


def get_library_series_detail(db_path: Path, series_id: int) -> dict:
    """Get detailed information about a specific series."""
    with get_db(db_path) as conn:
        series_row = conn.execute("SELECT id, title, cover_file_id FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series_row:
            return {"found": False, "series": None, "episodes": []}

        episode_rows = conn.execute(
            f"""
            WITH episode_card_stats AS (
                SELECT
                    episode_id,
                    COUNT(id) AS cards_count,
                    COUNT(DISTINCT CASE WHEN word IS NOT NULL AND TRIM(word) != '' THEN word END) AS mined_words_count
                FROM cards
                GROUP BY episode_id
            )
            SELECT
                e.id,
                e.title,
                e.episode_number,
                e.season_number,
                e.duration_seconds,
                video_file.id IS NOT NULL AS has_video,
                subtitle_file.id IS NOT NULL AS has_subtitle,
                video_file.id AS video_file_id,
                subtitle_file.id AS subtitle_file_id,
                video_name.relative_path AS video_filename,
                subtitle_name.relative_path AS subtitle_filename,
                COALESCE(wp.current_time_seconds, 0) AS current_time_seconds,
                COALESCE(wp.watched_seconds, 0) AS watched_seconds,
                COALESCE(wp.completed, 0) AS completed,
                wp.last_watched_at,
                COALESCE(ecs.cards_count, 0) AS cards_count,
                COALESCE(ecs.mined_words_count, 0) AS mined_words_count
            FROM episodes e
            LEFT JOIN watch_progress wp ON wp.episode_id = e.id
            LEFT JOIN library_files video_file ON video_file.id = ({primary_file_id_sql("video")})
            LEFT JOIN library_files subtitle_file ON subtitle_file.id = ({primary_file_id_sql("subtitle")})
            LEFT JOIN library_files video_name ON video_name.id = ({primary_file_id_sql("video", existing=False)})
            LEFT JOIN library_files subtitle_name
                ON subtitle_name.id = ({primary_file_id_sql("subtitle", existing=False)})
            LEFT JOIN episode_card_stats ecs ON ecs.episode_id = e.id
            WHERE e.series_id = ?
            ORDER BY COALESCE(e.season_number, 1), e.episode_number IS NULL, e.episode_number, e.title
            """,
            (series_id,),
        ).fetchall()

        episodes = []
        episodes_count = 0
        episodes_with_video = 0
        episodes_with_subtitle = 0
        for row in episode_rows:
            has_video = bool(row["has_video"])
            has_subtitle = bool(row["has_subtitle"])
            episodes_count += 1
            if has_video:
                episodes_with_video += 1
            if has_subtitle:
                episodes_with_subtitle += 1
            episodes.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "episodeNumber": row["episode_number"],
                    "seasonNumber": row["season_number"],
                    "durationSeconds": row["duration_seconds"],
                    "hasVideo": has_video,
                    "hasSubtitle": has_subtitle,
                    "videoFileId": row["video_file_id"],
                    "subtitleFileId": row["subtitle_file_id"],
                    "videoFilename": row["video_filename"],
                    "subtitleFilename": row["subtitle_filename"],
                    "currentTimeSeconds": float(row["current_time_seconds"] or 0),
                    "watchedSeconds": float(row["watched_seconds"] or 0),
                    "completed": bool(row["completed"]),
                    "lastWatchedAt": row["last_watched_at"],
                    "cardsCount": int(row["cards_count"]),
                    "minedWordsCount": int(row["mined_words_count"]),
                    "linkStatus": _episode_link_status(has_video, has_subtitle),
                }
            )

        series = {
            "id": series_row["id"],
            "title": series_row["title"],
            "coverUrl": f"/library/cover/{series_row['id']}" if series_row["cover_file_id"] else None,
            "episodesCount": episodes_count,
            "episodesWithVideo": episodes_with_video,
            "episodesWithSubtitle": episodes_with_subtitle,
            "linkStatus": _series_link_status(episodes_count, episodes_with_video, episodes_with_subtitle),
        }
        return {"found": True, "series": series, "episodes": episodes}


def get_library_series_debug(db_path: Path) -> list[dict]:
    """Get debug information about all series."""
    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                s.id,
                s.title,
                COUNT(DISTINCT e.id) AS episodes_count,
                COUNT(DISTINCT CASE WHEN lf.file_type = 'video' THEN lf.id END) AS video_files_count,
                COUNT(DISTINCT CASE WHEN lf.file_type = 'subtitle' THEN lf.id END) AS subtitle_files_count,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM library_files vf
                        WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1
                    ) THEN e.id
                END) AS episodes_with_video,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM library_files sf
                        WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1
                    ) THEN e.id
                END) AS episodes_with_subtitle,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM library_files vf
                        WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1
                    )
                    AND EXISTS (
                        SELECT 1 FROM library_files sf
                        WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1
                    ) THEN e.id
                END) AS episodes_with_video_and_subtitle,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM library_files vf
                        WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM library_files sf
                        WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1
                    ) THEN e.id
                END) AS episodes_video_only,
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM library_files sf
                        WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM library_files vf
                        WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1
                    ) THEN e.id
                END) AS episodes_subtitle_only
            FROM series s
            LEFT JOIN episodes e ON e.series_id = s.id
            LEFT JOIN library_files lf ON lf.episode_id = e.id
            GROUP BY s.id, s.title
            ORDER BY s.sort_title, s.title
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_library_series_files_debug(db_path: Path, series_id: int) -> dict:
    """Get debug information about files in a specific series."""
    with get_db(db_path) as conn:
        series = conn.execute("SELECT id, title FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series:
            return {"found": False, "series": None, "files": []}

        rows = conn.execute(
            """
            SELECT
                lf.id AS file_id,
                lf.file_type,
                lf.relative_path,
                lf.file_exists,
                lf.is_primary,
                e.id AS episode_id,
                e.title AS episode_title,
                e.episode_number,
                e.season_number,
                e.normalized_key
            FROM library_files lf
            LEFT JOIN episodes e ON e.id = lf.episode_id
            WHERE lf.series_id = ?
            ORDER BY e.season_number, e.episode_number, lf.file_type, lf.relative_path
            """,
            (series_id,),
        ).fetchall()

        return {"found": True, "series": dict(series), "files": [dict(row) for row in rows]}


def _episode_link_status(has_video: bool, has_subtitle: bool) -> str:
    if has_video and has_subtitle:
        return "linked"
    if has_video or has_subtitle:
        return "partial"
    return "missing"


def _series_link_status(episodes_count: int, episodes_with_video: int, episodes_with_subtitle: int) -> str:
    if episodes_count <= 0:
        return "missing"
    if episodes_with_video <= 0 and episodes_with_subtitle <= 0:
        return "missing"
    if episodes_with_video == episodes_count and episodes_with_subtitle == episodes_count:
        return "linked"
    return "partial"
