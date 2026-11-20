"""Library service layer for business logic.

This module contains business logic that operates on data from the repository layer.
"""

from pathlib import Path
import logging

from backend.library_ignore import library_folder_is_ignored
from backend.repositories.connection import get_db
from backend.repositories.library_repository import get_library_series_list, get_series_media_paths


logger = logging.getLogger(__name__)


def list_visible_library_series(db_path: Path, media_root: Path) -> list[dict]:
    is_ignored = library_folder_is_ignored(media_root.resolve())
    visible_media: dict[tuple[int, str], bool] = {}
    for file in get_series_media_paths(db_path):
        key = (file["series_id"], file["file_type"])
        visible_media[key] = visible_media.get(key, False) or not is_ignored(Path(file["path"]).parent)

    return [
        series for series in get_library_series_list(db_path)
        if visible_media.get((series["id"], "video"), visible_media.get((series["id"], "subtitle"), True))
    ]


def relink_library_series_files(db_path: Path, series_id: int, new_base: Path, media_root: Path) -> dict:
    """Rebind missing video/subtitle paths for a series without rebuilding the DB."""
    from backend.repositories.library_repository import refresh_library_file_existence

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
                unresolved.append(
                    {
                        "fileId": row["id"],
                        "fileType": row["file_type"],
                        "oldPath": row["path"],
                        "relativePath": row["relative_path"],
                    }
                )
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
            relinked.append(
                {
                    "fileId": row["id"],
                    "fileType": row["file_type"],
                    "oldPath": row["path"],
                    "newPath": str(matched_path),
                }
            )

    return {
        "found": True,
        "seriesId": series_id,
        "checked": len(rows),
        "relinked": relinked,
        "unresolved": unresolved,
    }


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
            logger.exception("Could not search for relocated media")

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        key = str(resolved).lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(resolved)
    return unique
