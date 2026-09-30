import pytest
from flask import Flask

from backend.repositories.library_repository import init_library_db
from backend.repositories import candidate_repository as repository
from backend.repositories.connection import get_db
from backend.routes.candidate_routes import candidate_bp
from backend.services.candidate_context_service import update_candidate_context
from tests.test_mining_candidates import setup


def context_for(snapshot):
    snapshot['currentIdx'] = 1
    return dict(cues=[dict(start=1, end=4, text='前'),
                      dict(start=10, end=15, text=snapshot['combinedText']),
                      dict(start=17, end=20, text='次')],
                start=1, end=1, anchor=1, startOffset=0, endOffset=0)


def test_edit_keeps_media_and_survives_restart(setup):
    settings, snapshot = setup
    context = context_for(snapshot)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    data = dict(revision=0, context=context, start=0, end=2)
    updated = update_candidate_context(settings.library_db_path, candidate['id'], data)
    assert updated['snapshot']['combinedText'] == '前 猫です。 次'
    assert updated['snapshot']['audioStart'] == 1
    assert updated['snapshot']['audioEnd'] == 20
    assert updated['snapshot']['imageSubtitleText'] == '前 猫です。 次'
    assert updated['snapshot']['targetTime'] == snapshot['targetTime']
    assert updated['snapshot']['selectedWord'] == snapshot['selectedWord']
    assert updated['revision'] == 1
    init_library_db(settings.library_db_path)
    assert repository.get_candidate(settings.library_db_path, candidate['id']) == updated
    with pytest.raises(ValueError, match='another tab'):
        update_candidate_context(settings.library_db_path, candidate['id'], data)
    with pytest.raises(ValueError, match='another tab'):
        repository.change_candidate(settings.library_db_path, candidate['id'], 'claim', revision=0)


def test_edit_refuses_active_and_finished_candidates(setup):
    settings, snapshot = setup
    context = context_for(snapshot)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    token = repository.change_candidate(settings.library_db_path, candidate['id'], 'claim')['token']
    data = dict(revision=0, context=context, start=1, end=2)
    with pytest.raises(ValueError, match='active Anki'):
        update_candidate_context(settings.library_db_path, candidate['id'], data)
    repository.change_candidate(settings.library_db_path, candidate['id'], 'release', token)
    repository.change_candidate(settings.library_db_path, candidate['id'], 'reject')
    with pytest.raises(ValueError, match='pending'):
        update_candidate_context(settings.library_db_path, candidate['id'], data)


@pytest.mark.parametrize('start,end', [(2, 2), (0, 0), (-1, 2), (0, 3), (True, 2), (0.5, 2)])
def test_invalid_range_is_atomic(setup, start, end):
    settings, snapshot = setup
    context = context_for(snapshot)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    with pytest.raises(ValueError):
        update_candidate_context(settings.library_db_path, candidate['id'], dict(revision=0, context=context, start=start, end=end))
    assert repository.get_candidate(settings.library_db_path, candidate['id']) == candidate


def test_legacy_mismatch_and_saved_cues_are_protected(setup):
    settings, snapshot = setup
    context = context_for(snapshot)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    context['cues'][1]['text'] = 'changed text'
    with pytest.raises(ValueError, match='do not match'):
        update_candidate_context(settings.library_db_path, candidate['id'], dict(revision=0, context=context, start=0, end=2))
    context['cues'][1]['text'] = snapshot['combinedText']
    updated = update_candidate_context(settings.library_db_path, candidate['id'], dict(revision=0, context=context, start=0, end=2))
    context['cues'][0]['text'] = 'tampered'
    restored = update_candidate_context(settings.library_db_path, candidate['id'], dict(revision=1, context=context, start=0, end=1))
    assert restored['snapshot']['combinedText'] == '前 猫です。'


def test_context_route_and_version_three_migration(setup):
    settings, snapshot = setup
    context = context_for(snapshot)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    with get_db(settings.library_db_path) as conn:
        conn.execute('ALTER TABLE mining_candidates DROP COLUMN revision')
        conn.execute("UPDATE schema_meta SET value = '3' WHERE key = 'schema_version'")
    init_library_db(settings.library_db_path)
    app = Flask(__name__)
    app.config['SETTINGS'] = settings
    app.register_blueprint(candidate_bp)
    client = app.test_client()
    response = client.post(f"/mining-candidates/{candidate['id']}/context", json=dict(revision=0, context=context, start=0, end=2))
    assert response.status_code == 200
    assert response.json['candidate']['snapshot']['audioEnd'] == 20


def test_new_capture_retains_cues_and_rejects_bad_context(setup):
    from backend.services.candidate_service import capture_candidate
    settings, snapshot = setup
    snapshot['context'] = context_for(snapshot)
    candidate = capture_candidate(settings, snapshot)
    assert candidate['snapshot']['context'] == snapshot['context']
    snapshot['context']['startOffset'] = float('nan')
    with pytest.raises(ValueError, match='offset'):
        capture_candidate(settings, snapshot)


def test_timed_subtitles_follow_edited_candidate_context(setup):
    settings, snapshot = setup
    context = context_for(snapshot)
    snapshot.update(imageSubtitleMode='timed', imageSubtitleDelay=2)
    candidate = repository.create_candidate(settings.library_db_path, snapshot, 'source', None)
    updated = update_candidate_context(settings.library_db_path, candidate['id'],
                                       dict(revision=0, context=context, start=0, end=2))
    assert updated['snapshot']['imageSubtitleMode'] == 'timed'
    assert updated['snapshot']['imageSubtitleCues'] == [
        dict(start=3, end=6, text='前'), dict(start=12, end=17, text='猫です。'),
        dict(start=19, end=22, text='次')]
