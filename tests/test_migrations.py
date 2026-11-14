import pytest
from contextlib import contextmanager

from backend.migrations import runner
from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db


def test_existing_database_gets_index_once(tmp_path, monkeypatch):
    path = tmp_path / "library.db"
    init_library_db(path)
    with get_db(path) as conn:
        conn.execute("DROP INDEX idx_library_files_episode_type")
        conn.execute("UPDATE schema_meta SET value = '4'")
    init_library_db(path)
    with get_db(path) as conn:
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert any(row[1] == "idx_library_files_episode_type" for row in conn.execute("PRAGMA index_list(library_files)"))
    def unexpected(_conn):
        raise AssertionError("Applied migration ran again")
    monkeypatch.setattr(runner, "MIGRATIONS", [(5, "already applied", unexpected)])
    init_library_db(path)


def test_failed_migration_rolls_back_schema_and_version(tmp_path, monkeypatch):
    path = tmp_path / "library.db"
    init_library_db(path)
    def failing(conn):
        conn.execute("CREATE TABLE should_rollback(id INTEGER)")
        raise RuntimeError("migration failed")
    monkeypatch.setattr(runner, "MIGRATIONS", [(7, "failure", failing)])
    with pytest.raises(RuntimeError, match="migration failed"):
        init_library_db(path)
    with get_db(path) as conn:
        assert conn.execute("SELECT value FROM schema_meta WHERE key='schema_version'").fetchone()[0] == "6"
        assert not conn.execute("SELECT 1 FROM sqlite_master WHERE name='should_rollback'").fetchone()


def test_migration_reads_version_after_write_lock(tmp_path, monkeypatch):
    path = tmp_path / "library.db"
    init_library_db(path)
    statements = []
    @contextmanager
    def traced_db(db_path):
        with get_db(db_path) as conn:
            conn.set_trace_callback(statements.append)
            yield conn
    monkeypatch.setattr(runner, "get_db", traced_db)
    runner.run_migrations(path)
    version_read = next(index for index, sql in enumerate(statements) if "SELECT value FROM schema_meta" in sql)
    assert statements.index("BEGIN IMMEDIATE") < version_read


def test_existing_delete_journal_database_switches_to_wal(tmp_path):
    path = tmp_path / 'old.db'
    init_library_db(path)
    with get_db(path) as conn:
        conn.execute('PRAGMA journal_mode = DELETE')
    init_library_db(path)
    with get_db(path) as conn:
        assert conn.execute('PRAGMA journal_mode').fetchone()[0] == 'wal'


def test_episode_exclusion_upgrades_existing_library(tmp_path):
    path = tmp_path / "old.db"
    init_library_db(path)
    with get_db(path) as conn:
        conn.execute("ALTER TABLE episodes DROP COLUMN is_ignored")
        conn.execute("UPDATE schema_meta SET value = '5' WHERE key = 'schema_version'")
        series_id = conn.execute("INSERT INTO series(title, normalized_title) VALUES('Show', 'show')").lastrowid
        conn.execute("INSERT INTO episodes(series_id, normalized_key) VALUES(?, 'show|e1')", (series_id,))
    init_library_db(path)
    with get_db(path) as conn:
        assert conn.execute("SELECT is_ignored FROM episodes").fetchone()[0] == 0
        conn.execute("UPDATE episodes SET is_ignored = 1")
    init_library_db(path)
    with get_db(path) as conn:
        assert conn.execute("SELECT is_ignored FROM episodes").fetchone()[0] == 1
