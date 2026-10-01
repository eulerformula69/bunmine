import pytest

from backend import settings
from backend.repositories.connection import get_db


def test_connection_rolls_back_failed_write(tmp_path):
    db = tmp_path / 'test.db'
    with get_db(db) as conn:
        conn.execute('CREATE TABLE items(id INTEGER PRIMARY KEY)')
    with pytest.raises(RuntimeError):
        with get_db(db, immediate=True) as conn:
            assert conn.in_transaction
            assert conn.execute('PRAGMA busy_timeout').fetchone()[0] == 5000
            assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
            conn.execute('INSERT INTO items VALUES(1)')
            raise RuntimeError('rollback')
    with get_db(db) as conn:
        assert conn.execute('SELECT COUNT(*) FROM items').fetchone()[0] == 0


def test_env_file_does_not_replace_existing_values(tmp_path, monkeypatch):
    path = tmp_path / '.env'
    path.write_text('BUNMINE_TEST_FIRST=file\nBUNMINE_TEST_SECOND="quoted value"\n# comment\ninvalid')
    monkeypatch.setenv('BUNMINE_TEST_FIRST', 'existing')
    monkeypatch.delenv('BUNMINE_TEST_SECOND', raising=False)
    settings.load_env_file(path)
    assert settings.os.environ['BUNMINE_TEST_FIRST'] == 'existing'
    assert settings.os.environ['BUNMINE_TEST_SECOND'] == 'quoted value'
    monkeypatch.delenv('BUNMINE_TEST_SECOND')


def test_settings_require_media_paths_without_creating_directories(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'load_env_file', lambda _: None)
    monkeypatch.delenv('ANKI_MEDIA_DIR', raising=False)
    with pytest.raises(RuntimeError, match='ANKI_MEDIA_DIR'):
        settings.load_settings()
    monkeypatch.setenv('ANKI_MEDIA_DIR', str(tmp_path / 'anki'))
    monkeypatch.setenv('MEDIA_LIBRARY_DIR', str(tmp_path / 'media'))
    result = settings.load_settings()
    assert result.media_library_dir == tmp_path / 'media'
    assert not result.media_library_dir.exists()
