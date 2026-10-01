from backend.library_deletion import delete_library_series, delete_missing_library_episode
from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db


def test_missing_deletion_does_not_touch_other_series(tmp_path):
    db = tmp_path / 'library.db'
    init_library_db(db)
    with get_db(db) as conn:
        conn.execute("INSERT INTO series(id,title,normalized_title) VALUES(1,'Keep','keep')")
    assert delete_library_series(db, 2) == {'found': False}
    assert delete_missing_library_episode(db, 2) == {'found': False}
    with get_db(db) as conn:
        assert conn.execute('SELECT title FROM series WHERE id=1').fetchone()[0] == 'Keep'
