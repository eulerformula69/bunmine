from types import SimpleNamespace

import pytest
from flask import Flask

from backend.library_db import init_library_db
from backend.repositories import candidate_repository as repository
from backend.repositories.connection import get_db
from backend.routes.candidate_routes import candidate_bp
from backend.services.candidate_service import capture_candidate, check_source


def test_migration_from_version_two(tmp_path):
    db = tmp_path / 'old.db'
    with get_db(db) as conn:
        conn.execute('CREATE TABLE schema_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        conn.execute("INSERT INTO schema_meta VALUES ('schema_version', '2')")
    init_library_db(db)
    init_library_db(db)
    assert repository.list_candidates(db) == []


@pytest.fixture
def setup(tmp_path):
    settings = SimpleNamespace(library_db_path=tmp_path / 'library.db', video_dir=tmp_path,
                               media_library_dir=tmp_path)
    init_library_db(settings.library_db_path)
    (tmp_path / 'test.mkv').write_bytes(b'original video')
    snapshot = dict(videoPayload={'filename': 'test.mkv'}, selectedWord='猫', combinedText='猫です。',
                    currentIdx=3, targetTime=12, audioStart=10, audioEnd=15, volumeLevel=1,
                    screenshotMode='current', imageSubtitleText='猫です。', fontSize='24', trackIndex='default',
                    ankiUrl='', deckName='', pictureField='', audioField='', sentenceField='')
    return settings, snapshot


def test_capture_survives_restart_and_schema_upgrade(setup):
    settings, snapshot = setup
    candidate = capture_candidate(settings, snapshot)
    with get_db(settings.library_db_path) as conn:
        conn.execute("UPDATE schema_meta SET value = '2' WHERE key = 'schema_version'")
    init_library_db(settings.library_db_path)
    restored = repository.list_candidates(settings.library_db_path)
    assert restored == [candidate]
    assert restored[0]['snapshot'] == snapshot
    with get_db(settings.library_db_path) as conn:
        assert conn.execute("SELECT value FROM schema_meta WHERE key = 'schema_version'").fetchone()[0] == '3'
        assert conn.execute('SELECT COUNT(*) FROM cards').fetchone()[0] == 0


def test_accept_reject_and_note_retry(setup):
    settings, snapshot = setup
    db = settings.library_db_path
    first = capture_candidate(settings, snapshot)['id']
    second = capture_candidate(settings, snapshot)['id']
    token = repository.change_candidate(db, first, 'claim')['token']
    with pytest.raises(ValueError):
        repository.change_candidate(db, first, 'accept', token)
    repository.change_candidate(db, first, 'bind', token, 123)
    repository.change_candidate(db, first, 'release', token)
    init_library_db(db)
    assert repository.get_candidate(db, first)['anki_note_id'] == 123
    token = repository.change_candidate(db, first, 'claim')['token']
    repository.change_candidate(db, first, 'accept', token)
    repository.change_candidate(db, second, 'reject')
    assert repository.list_candidates(db) == []
    assert repository.get_candidate(db, first)['status'] == 'accepted'
    assert repository.get_candidate(db, second)['status'] == 'rejected'
    with pytest.raises(ValueError):
        repository.change_candidate(db, first, 'claim')


def test_only_one_acquire_across_sessions_and_expiry(setup):
    settings, snapshot = setup
    db = settings.library_db_path
    first = capture_candidate(settings, snapshot)['id']
    second = capture_candidate(settings, snapshot)['id']
    token = repository.change_candidate(db, first, 'claim')['token']
    for candidate_id in (first, second):
        with pytest.raises(ValueError):
            repository.change_candidate(db, candidate_id, 'claim')
        with pytest.raises(ValueError):
            repository.change_candidate(db, candidate_id, 'reject')
    with pytest.raises(ValueError):
        repository.change_candidate(db, first, 'bind', 'wrong', 123)
    repository.change_candidate(db, first, 'renew', token)
    with get_db(db) as conn:
        conn.execute('UPDATE mining_acquire SET expires = 0')
    repository.change_candidate(db, second, 'claim')
    with pytest.raises(ValueError):
        repository.change_candidate(db, first, 'accept', token)


def test_source_replacement_and_missing_file(setup):
    settings, snapshot = setup
    candidate = capture_candidate(settings, snapshot)
    assert check_source(settings, candidate['id']) == candidate
    source = settings.video_dir / 'test.mkv'
    source.write_bytes(b'different video content')
    with pytest.raises(ValueError, match='changed'):
        check_source(settings, candidate['id'])
    source.unlink()
    with pytest.raises(ValueError, match='not found'):
        check_source(settings, candidate['id'])
    assert len(repository.list_candidates(settings.library_db_path)) == 1


def test_startup_keeps_uploaded_source(setup):
    from backend.services.startup_service import cleanup_on_startup
    settings, snapshot = setup
    settings.dedupe_index_path = settings.video_dir / 'dedupe_index.json'
    candidate = capture_candidate(settings, snapshot)
    cleanup_on_startup(settings)
    init_library_db(settings.library_db_path)
    assert check_source(settings, candidate['id']) == candidate


def test_library_source_keeps_episode_and_video_id(setup):
    settings, snapshot = setup
    with get_db(settings.library_db_path) as conn:
        conn.execute("INSERT INTO series(id, title, normalized_title) VALUES (1, 'Show', 'show')")
        conn.execute("INSERT INTO episodes(id, series_id, normalized_key) VALUES (2, 1, 'show-1')")
        conn.execute("""INSERT INTO library_files(id, episode_id, file_type, path, relative_path)
                     VALUES (3, 2, 'video', ?, 'test.mkv')""", (str(settings.video_dir / 'test.mkv'),))
    snapshot['videoPayload'] = {'videoFileId': 3}
    candidate = capture_candidate(settings, snapshot)
    assert candidate['episode_id'] == 2
    assert check_source(settings, candidate['id'])['snapshot']['videoPayload'] == {'videoFileId': 3}


@pytest.mark.parametrize('change', [
    {'selectedWord': ''}, {'currentIdx': -1}, {'audioEnd': 1}, {'targetTime': float('nan')},
    {'videoPayload': {'filename': '../test.mkv'}}, {'audioStart': True},
])
def test_invalid_capture(setup, change):
    settings, snapshot = setup
    with pytest.raises(ValueError):
        capture_candidate(settings, {**snapshot, **change})


def test_routes(setup):
    settings, snapshot = setup
    app = Flask(__name__)
    app.config['SETTINGS'] = settings
    app.register_blueprint(candidate_bp)
    client = app.test_client()
    response = client.post('/mining-candidates', json={'snapshot': snapshot})
    assert response.status_code == 201
    candidate_id = response.json['candidate']['id']
    assert len(client.get('/mining-candidates').json['candidates']) == 1
    assert client.get(f'/mining-candidates/{candidate_id}/source').status_code == 200
    claim = client.post(f'/mining-candidates/{candidate_id}/claim', json={})
    token = claim.json['token']
    assert client.post(f'/mining-candidates/{candidate_id}/reject', json={}).status_code == 409
    bound = client.post(f'/mining-candidates/{candidate_id}/bind', json={'token': token, 'noteId': 123})
    assert bound.status_code == 200
    assert bound.json == {}
    accepted = client.post(f'/mining-candidates/{candidate_id}/accept', json={'token': token})
    assert accepted.status_code == 200
    assert accepted.json == {}
    assert client.get('/mining-candidates').json['candidates'] == []
