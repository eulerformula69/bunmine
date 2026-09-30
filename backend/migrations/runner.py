"""Migration runner."""

from pathlib import Path

from backend.migrations.migration_001_initial import migrate as migrate_001


MIGRATIONS = [
    ("001", "initial", migrate_001),
]


def run_migrations(db_path: Path) -> None:
    """Run all pending migrations."""
    for version, name, migrate_func in MIGRATIONS:
        migrate_func(db_path)
