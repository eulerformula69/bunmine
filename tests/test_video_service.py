import pytest

from backend.repositories.connection import get_db
from backend.repositories.library_repository import init_library_db
from backend.services.video_service import resolve_media_file, resolve_video_path_from_payload


@pytest.mark.parametrize('payload,status', [(None, 400), ({}, 400), ({'videoFileId': 'bad'}, 400), ({'filename': '../a.mkv'}, 400)])
def test_invalid_video_payload_rejected(temporary_settings, payload, status):
    path, info, error = resolve_video_path_from_payload(payload, temporary_settings)
    assert path is None and info is None and error[1] == status


def test_library_resolution_checks_root_and_disk(temporary_settings, tmp_path):
    settings = temporary_settings
    settings.data_dir.mkdir()
    settings.media_library_dir.mkdir()
    init_library_db(settings.library_db_path)
    outside = tmp_path / 'outside.mkv'
    outside.write_bytes(b'video')
    with get_db(settings.library_db_path) as conn:
        file_id = conn.execute("INSERT INTO library_files(file_type,path,relative_path) VALUES('video',?,?)",
                               (str(outside), outside.name)).lastrowid
    assert resolve_media_file(file_id, settings)[2][1] == 403
    assert resolve_media_file(file_id + 1, settings)[2][1] == 404
    inside = settings.media_library_dir / 'inside.mkv'
    with get_db(settings.library_db_path) as conn:
        conn.execute('UPDATE library_files SET path = ? WHERE id = ?', (str(inside), file_id))
    assert resolve_media_file(file_id, settings)[2][1] == 404
    inside.write_bytes(b'video')
    assert resolve_media_file(file_id, settings)[0] == inside
