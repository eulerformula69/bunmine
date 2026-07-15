from pathlib import Path
import os

from backend.repositories.connection import get_db
from backend.repositories.playback_repository import (
    get_episode_playback,
    get_library_file_by_id,
    save_episode_progress,
    set_episode_completed,
)


SCHEMA_VERSION = 2


def refresh_library_file_existence(db_path: Path, file_types: list[str] | tuple[str, ...] | set[str] | None = None) -> dict:
    """Mark DB file records as missing when the file disappeared from disk.

    Scanner updates this too, but user can rename/delete files after a subtitle/cover was saved.
    This helper keeps library reads honest without requiring a manual rescan.
    """
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
            if file_path.exists() and file_path.is_file():
                continue
            missing_ids.append(int(row["id"]))

        if missing_ids:
            placeholders = ", ".join("?" for _ in missing_ids)
            conn.execute(
                f"""
                UPDATE library_files
                SET file_exists = 0,
                    missing_since = COALESCE(missing_since, CURRENT_TIMESTAMP),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id IN ({placeholders})
                """,
                tuple(missing_ids),
            )
            marked_missing = len(missing_ids)

    return {"checked": checked, "markedMissing": marked_missing}



def _path_candidates_for_relink(new_base: Path, stored_path: Path, relative_path: str) -> list[Path]:
    candidates: list[Path] = []
    if new_base.is_file():
        candidates.append(new_base)
    else:
        rel = Path(relative_path or stored_path.name)
        candidates.append(new_base / rel)
        candidates.append(new_base / stored_path.name)
        try:
            for match in new_base.rglob(stored_path.name):
                candidates.append(match)
        except OSError:
            pass

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        key = os.path.normcase(str(resolved))
        if key in seen:
            continue
        seen.add(key)
        unique.append(resolved)
    return unique


def relink_library_series_files(db_path: Path, series_id: int, new_base: Path, media_root: Path) -> dict:
    """Rebind missing video/subtitle paths for a series without rebuilding the DB."""
    refresh_library_file_existence(db_path, {"video", "subtitle"})
    new_base = new_base.expanduser().resolve()
    media_root = media_root.expanduser().resolve()

    with get_db(db_path) as conn:
        series = conn.execute("SELECT id, title FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series:
            return {"found": False}

        rows = conn.execute(
            """
            SELECT id, path, relative_path, file_type
            FROM library_files
            WHERE series_id = ?
              AND file_type IN ('video', 'subtitle')
              AND file_exists = 0
            ORDER BY file_type, relative_path
            """,
            (series_id,),
        ).fetchall()

        relinked: list[dict] = []
        unresolved: list[dict] = []

        for row in rows:
            stored_path = Path(row["path"]).expanduser()
            matched_path = None
            for candidate in _path_candidates_for_relink(new_base, stored_path, row["relative_path"]):
                if candidate.exists() and candidate.is_file():
                    matched_path = candidate
                    break

            if not matched_path:
                unresolved.append({
                    "fileId": row["id"],
                    "fileType": row["file_type"],
                    "oldPath": row["path"],
                    "relativePath": row["relative_path"],
                })
                continue

            try:
                relative = str(matched_path.relative_to(media_root))
            except ValueError:
                relative = matched_path.name

            conn.execute(
                """
                UPDATE library_files
                SET path = ?, relative_path = ?, file_exists = 1, missing_since = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (str(matched_path), relative, row["id"]),
            )
            relinked.append({
                "fileId": row["id"],
                "fileType": row["file_type"],
                "oldPath": row["path"],
                "newPath": str(matched_path),
            })

    return {
        "found": True,
        "seriesId": series_id,
        "checked": len(rows),
        "relinked": relinked,
        "unresolved": unresolved,
    }

def init_library_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with get_db(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                normalized_title TEXT NOT NULL UNIQUE,
                sort_title TEXT,
                cover_file_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_series_normalized_title
                ON series(normalized_title);

            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER NOT NULL,
                episode_number REAL,
                season_number INTEGER,
                title TEXT,
                normalized_key TEXT NOT NULL UNIQUE,
                duration_seconds REAL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_episodes_series_id
                ON episodes(series_id);

            CREATE INDEX IF NOT EXISTS idx_episodes_normalized_key
                ON episodes(normalized_key);

            CREATE TABLE IF NOT EXISTS library_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER,
                episode_id INTEGER,
                file_type TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                relative_path TEXT NOT NULL,
                file_exists INTEGER NOT NULL DEFAULT 1,
                is_primary INTEGER NOT NULL DEFAULT 0,
                linked_at TEXT,
                missing_since TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_library_files_series_id
                ON library_files(series_id);

            CREATE INDEX IF NOT EXISTS idx_library_files_episode_id
                ON library_files(episode_id);

            CREATE INDEX IF NOT EXISTS idx_library_files_file_type
                ON library_files(file_type);

            CREATE INDEX IF NOT EXISTS idx_library_files_file_exists
                ON library_files(file_exists);

            CREATE TABLE IF NOT EXISTS watch_progress (
                episode_id INTEGER PRIMARY KEY,
                current_time_seconds REAL NOT NULL DEFAULT 0,
                duration_seconds REAL,
                watched_seconds REAL NOT NULL DEFAULT 0,
                completed INTEGER NOT NULL DEFAULT 0,
                last_watched_at TEXT,

                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_watch_progress_completed
                ON watch_progress(completed);

            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER,
                episode_id INTEGER,
                note_id TEXT NOT NULL UNIQUE,
                word TEXT,
                sentence TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cards_series_id
                ON cards(series_id);

            CREATE INDEX IF NOT EXISTS idx_cards_episode_id
                ON cards(episode_id);

            CREATE INDEX IF NOT EXISTS idx_cards_note_id
                ON cards(note_id);
            """
        )

        conn.execute(
            """
            INSERT INTO schema_meta(key, value)
            VALUES('schema_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(SCHEMA_VERSION),),
        )


def delete_library_series(db_path: Path, series_id: int) -> dict:
    """Compatibility wrapper for the deletion service."""
    from backend.library_deletion import delete_library_series as delete_series

    return delete_series(db_path, series_id)


def get_library_db_status(db_path: Path) -> dict:
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


def get_library_series_debug(db_path: Path) -> list[dict]:
    refresh_library_file_existence(db_path, {"video", "subtitle", "cover"})
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
    refresh_library_file_existence(db_path, {"video", "subtitle", "cover"})
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


def get_library_series_list(db_path: Path) -> list[dict]:
    refresh_library_file_existence(db_path, {"video", "subtitle", "cover"})
    with get_db(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                s.id,
                s.title,
                s.cover_file_id,
                COUNT(DISTINCT e.id) AS episodes_count,
                COUNT(DISTINCT CASE WHEN EXISTS (
                    SELECT 1 FROM library_files vf
                    WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1
                ) THEN e.id END) AS episodes_with_video,
                COUNT(DISTINCT CASE WHEN EXISTS (
                    SELECT 1 FROM library_files sf
                    WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1
                ) THEN e.id END) AS episodes_with_subtitle,
                COUNT(DISTINCT CASE WHEN wp.completed = 1 THEN e.id END) AS completed_episodes,
                COUNT(DISTINCT CASE WHEN wp.current_time_seconds > 5 AND wp.completed = 0 THEN e.id END) AS in_progress_episodes,
                COALESCE(SUM(wp.watched_seconds), 0) AS watched_seconds,
                MAX(wp.current_time_seconds) AS latest_current_time_seconds,
                MAX(wp.last_watched_at) AS last_watched_at,
                s.created_at,
                COUNT(DISTINCT c.id) AS cards_count,
                COUNT(DISTINCT CASE WHEN c.word IS NOT NULL AND TRIM(c.word) != '' THEN c.word END) AS mined_words_count
            FROM series s
            LEFT JOIN episodes e ON e.series_id = s.id
            LEFT JOIN watch_progress wp ON wp.episode_id = e.id
            LEFT JOIN cards c ON c.series_id = s.id
            GROUP BY s.id, s.title
            ORDER BY s.sort_title, s.title
            """
        ).fetchall()

        result = []
        for row in rows:
            episodes_count = int(row["episodes_count"])
            episodes_with_video = int(row["episodes_with_video"])
            episodes_with_subtitle = int(row["episodes_with_subtitle"])
            result.append({
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
            })
        return result


def get_library_series_detail(db_path: Path, series_id: int) -> dict:
    refresh_library_file_existence(db_path, {"video", "subtitle", "cover"})
    with get_db(db_path) as conn:
        series_row = conn.execute("SELECT id, title, cover_file_id FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series_row:
            return {"found": False, "series": None, "episodes": []}

        episode_rows = conn.execute(
            """
            SELECT
                e.id,
                e.title,
                e.episode_number,
                e.season_number,
                e.duration_seconds,
                EXISTS (SELECT 1 FROM library_files vf WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1) AS has_video,
                EXISTS (SELECT 1 FROM library_files sf WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1) AS has_subtitle,
                (SELECT vf.id FROM library_files vf WHERE vf.episode_id = e.id AND vf.file_type = 'video' AND vf.file_exists = 1 ORDER BY vf.is_primary DESC, vf.id ASC LIMIT 1) AS video_file_id,
                (SELECT sf.id FROM library_files sf WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' AND sf.file_exists = 1 ORDER BY sf.is_primary DESC, sf.id ASC LIMIT 1) AS subtitle_file_id,
                (SELECT vf.relative_path FROM library_files vf WHERE vf.episode_id = e.id AND vf.file_type = 'video' ORDER BY vf.is_primary DESC, vf.id ASC LIMIT 1) AS video_filename,
                (SELECT sf.relative_path FROM library_files sf WHERE sf.episode_id = e.id AND sf.file_type = 'subtitle' ORDER BY sf.is_primary DESC, sf.id ASC LIMIT 1) AS subtitle_filename,
                COALESCE(wp.current_time_seconds, 0) AS current_time_seconds,
                COALESCE(wp.watched_seconds, 0) AS watched_seconds,
                COALESCE(wp.completed, 0) AS completed,
                wp.last_watched_at,
                COUNT(DISTINCT c.id) AS cards_count,
                COUNT(DISTINCT CASE WHEN c.word IS NOT NULL AND TRIM(c.word) != '' THEN c.word END) AS mined_words_count
            FROM episodes e
            LEFT JOIN watch_progress wp ON wp.episode_id = e.id
            LEFT JOIN cards c ON c.episode_id = e.id
            WHERE e.series_id = ?
            GROUP BY e.id
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
            episodes.append({
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
            })

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
