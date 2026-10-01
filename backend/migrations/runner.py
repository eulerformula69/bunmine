"""Migration runner."""

from pathlib import Path

from backend.migrations.migration_001_initial import migrate as migrate_001
from backend.migrations.migration_005_episode_file_index import migrate as migrate_005
from backend.repositories.candidate_repository import migrate_candidates
from backend.repositories.connection import get_db


MIGRATIONS = [
    (1, "initial", migrate_001),
    (3, "mining candidates", migrate_candidates),
    (4, "candidate revisions", migrate_candidates),
    (5, "episode file index", migrate_005),
]


def run_migrations(db_path: Path) -> None:
    """Run all pending migrations."""
    with get_db(db_path) as conn:
        has_schema_meta = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'"
        ).fetchone()
        if not has_schema_meta:
            conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("BEGIN IMMEDIATE")
        has_schema_meta = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'"
        ).fetchone()
        current_version = 0
        if has_schema_meta:
            row = conn.execute("SELECT value FROM schema_meta WHERE key = 'schema_version'").fetchone()
            if row:
                current_version = int(row["value"])

        for version, _name, migrate_func in MIGRATIONS:
            if version <= current_version:
                continue
            migrate_func(conn)
            conn.execute(
                """
                INSERT INTO schema_meta(key, value)
                VALUES('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (str(version),),
            )
            current_version = version
