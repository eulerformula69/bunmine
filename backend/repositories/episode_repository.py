"""Manual episode classification."""

from pathlib import Path

from backend.repositories.connection import get_db


def set_episode_ignored(db_path: Path, episode_id: int, ignored: bool) -> bool:
    with get_db(db_path) as conn:
        result = conn.execute(
            "UPDATE episodes SET is_ignored = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (int(ignored), episode_id),
        )
        return result.rowcount > 0
