import sqlite3
from contextlib import contextmanager
from pathlib import Path
from collections.abc import Iterator


@contextmanager
def get_db(db_path: Path, *, immediate: bool = False) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(str(db_path), timeout=5.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        if immediate:
            conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
