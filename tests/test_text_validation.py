import pytest

from backend.text_processing import strip_html
from backend.utils_validation import is_within, safe_media_name, safe_uploaded_filename


def test_html_modes_keep_existing_whitespace_and_entities():
    assert strip_html('a<b>b</b>&amp;') == 'ab&'
    assert strip_html('a<b>b</b>&amp;', replacement=' ', decode_entities=False) == 'a b &amp;'
    assert strip_html('a<broken\ntag>b', preserve_newlines=True) == 'a<broken\ntag>b'
    assert strip_html('a<broken\ntag>b') == 'ab'


@pytest.mark.parametrize('name', ['', '../clip.mkv', r'..\clip.mkv', '/clip.mkv'])
def test_media_names_reject_path_components(name):
    with pytest.raises(ValueError):
        safe_media_name(name)


def test_media_validation_keeps_valid_filename_and_checks_root(tmp_path):
    assert safe_media_name('episode.mkv') == 'episode.mkv'
    assert safe_uploaded_filename('episode.mkv', {'.mkv'}) == 'episode.mkv'
    with pytest.raises(ValueError):
        safe_uploaded_filename('episode.exe', {'.mkv'})
    assert is_within(tmp_path, tmp_path / 'show' / 'episode.mkv')
    assert not is_within(tmp_path, tmp_path / '..' / 'episode.mkv')
