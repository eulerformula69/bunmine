import pytest

from backend.services import dedupe_service as dedupe


def test_cache_requires_nonempty_existing_media(temporary_settings):
    settings = temporary_settings
    settings.data_dir.mkdir()
    settings.audio_dir.mkdir()
    key = dedupe.make_dedupe_key('audio', {'start': 1, 'end': 2})
    assert key == dedupe.make_dedupe_key('audio', {'end': 2, 'start': 1})
    assert key != dedupe.make_dedupe_key('audio', {'start': 1, 'end': 3})
    dedupe.save_cached_media(settings, 'audio', key, 'clip.mp3')
    assert dedupe.get_cached_media(settings, 'audio', key) is None
    path = settings.audio_dir / 'clip.mp3'
    path.write_bytes(b'')
    assert dedupe.get_cached_media(settings, 'audio', key) is None
    path.write_bytes(b'audio')
    assert dedupe.get_cached_media(settings, 'audio', key) == 'clip.mp3'


@pytest.mark.parametrize('text', ['invalid json', '[]'])
def test_invalid_index_recovers_empty_cache(temporary_settings, text):
    temporary_settings.data_dir.mkdir()
    temporary_settings.dedupe_index_path.write_text(text)
    assert dedupe.load_dedupe_index(temporary_settings) == {'screenshot': {}, 'audio': {}}
