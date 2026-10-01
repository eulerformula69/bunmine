from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db
from backend.services import startup_service as startup


def test_cover_migration_preserves_current_path_on_repeated_start(temporary_settings):
    settings = temporary_settings
    settings.data_dir.mkdir()
    init_library_db(settings.library_db_path)
    current = settings.library_covers_dir / 'cover.jpg'
    with get_db(settings.library_db_path) as conn:
        conn.execute("INSERT INTO library_files(file_type, path, relative_path) VALUES('cover', ?, ?)",
                     (str(current), 'data/LibraryCovers/cover.jpg'))
    startup.migrate_cover_paths(settings)
    startup.migrate_cover_paths(settings)
    with get_db(settings.library_db_path) as conn:
        row = conn.execute('SELECT path, relative_path FROM library_files').fetchone()
    assert row['path'] == str(current)
    assert row['relative_path'] == 'data/LibraryCovers/cover.jpg'


def test_startup_copies_legacy_covers_before_creating_target(temporary_settings, monkeypatch):
    settings = temporary_settings
    legacy = settings.frontend_dir / 'LibraryCovers'
    legacy.mkdir(parents=True)
    (legacy / 'cover.jpg').write_bytes(b'cover')
    monkeypatch.setattr(startup, 'start_anki_highlight_startup_stale_check', lambda _: None)
    monkeypatch.setattr(startup, 'ensure_anki_highlight_files', lambda _: None)
    startup.initialize_backend(settings)
    startup.initialize_backend(settings)
    assert (settings.library_covers_dir / 'cover.jpg').read_bytes() == b'cover'
    assert (legacy / 'cover.jpg').read_bytes() == b'cover'


def test_legacy_copy_keeps_current_files(temporary_settings):
    settings = temporary_settings
    legacy = settings.frontend_dir / 'LibraryCovers'
    legacy.mkdir(parents=True)
    (legacy / 'cover.jpg').write_bytes(b'old')
    settings.library_covers_dir.mkdir(parents=True)
    (settings.library_covers_dir / 'cover.jpg').write_bytes(b'current')
    startup.migrate_legacy_data_paths(settings)
    assert (settings.library_covers_dir / 'cover.jpg').read_bytes() == b'current'


def test_legacy_cover_path_changes_only_once(temporary_settings):
    settings = temporary_settings
    settings.data_dir.mkdir()
    init_library_db(settings.library_db_path)
    with get_db(settings.library_db_path) as conn:
        conn.execute("INSERT INTO library_files(file_type, path, relative_path) VALUES('cover', ?, ?)",
                     (str(settings.frontend_dir / 'LibraryCovers' / 'old.jpg'), 'frontend/LibraryCovers/old.jpg'))
    startup.migrate_cover_paths(settings)
    startup.migrate_cover_paths(settings)
    with get_db(settings.library_db_path) as conn:
        row = conn.execute('SELECT path, relative_path FROM library_files').fetchone()
    assert row['path'] == str(settings.library_covers_dir / 'old.jpg')
    assert row['relative_path'] == 'data/LibraryCovers/old.jpg'
