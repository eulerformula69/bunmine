from flask import Flask

from backend import library_subtitles as subtitles
from backend.repositories.library_repository import init_library_db


def test_jimaku_cache_reuses_then_expires(tmp_path, monkeypatch):
    db = tmp_path / "library.sqlite3"
    init_library_db(db)
    calls = []
    monkeypatch.setattr(subtitles.time, "time", lambda: 100)
    monkeypatch.setattr(subtitles, "_http_json_get", lambda *_args, **_kwargs: calls.append(1) or [{"id": 7}])
    assert subtitles._cached_http_json_get(db, "https://jimaku.cc/api/entries", ttl_seconds=10) == [{"id": 7}]
    assert subtitles._cached_http_json_get(db, "https://jimaku.cc/api/entries", ttl_seconds=10) == [{"id": 7}]
    assert len(calls) == 1
    monkeypatch.setattr(subtitles.time, "time", lambda: 111)
    subtitles._cached_http_json_get(db, "https://jimaku.cc/api/entries", ttl_seconds=10)
    assert len(calls) == 2


def test_jimaku_candidate_filters_host_and_extension(temporary_settings):
    app = Flask(__name__)
    app.config["SETTINGS"] = temporary_settings
    with app.app_context():
        source = {"name": "Show 01.srt", "url": "https://jimaku.cc/entry/7/download/show.srt", "size": 42}
        candidate = subtitles._candidate_from_jimaku_file(source, 7, {"name": "Show"}, "Show", 1)
        assert candidate["filename"] == "Show 01.srt"
        assert candidate["sizeBytes"] == 42
        for url in ["http://jimaku.cc/entry/7/download/show.srt", "https://evil.test/entry/7/download/show.srt"]:
            assert subtitles._candidate_from_jimaku_file({**source, "url": url}, 7, {}, "Show") is None
        assert subtitles._candidate_from_jimaku_file({**source, "name": "archive.zip"}, 7, {}, "Show") is None
        assert subtitles._target_subtitle_path(temporary_settings.media_library_dir / "Show.mkv", "../../x.srt").name == "Show.srt"


def test_download_rejects_file_url():
    import pytest
    with pytest.raises(ValueError, match='Invalid Jimaku'):
        subtitles._http_download('file:///secret.srt')


def test_subtitle_download_limits_read_size(monkeypatch):
    import io
    import pytest
    class Response(io.BytesIO):
        def read(self, size=-1):
            assert size == 11
            return super().read(size)
    monkeypatch.setattr(subtitles.urllib.request.OpenerDirector, 'open', lambda *a, **k: Response(b'x' * 20))
    with pytest.raises(ValueError, match='size limit'):
        subtitles._http_download('https://jimaku.cc/entry/1/download/a.srt', max_bytes=10)


def test_subtitle_redirect_rejects_file_url():
    import pytest
    with pytest.raises(ValueError, match='Invalid Jimaku'):
        subtitles._JimakuRedirectHandler().redirect_request(None, None, 302, '', {}, 'file:///secret.srt')


def test_download_rejects_unsupported_filename_before_database_access(temporary_settings, monkeypatch):
    import pytest
    app = Flask(__name__)
    app.config['SETTINGS'] = temporary_settings
    monkeypatch.setattr(subtitles, 'get_episode_subtitle_context', lambda *_: pytest.fail('Must reject filename first'))
    with app.app_context(), pytest.raises(ValueError, match='Unsupported subtitle'):
        subtitles.download_and_save_jimaku_subtitle(temporary_settings.library_db_path, 1, {
            'source': 'jimaku', 'entryId': 1,
            'downloadUrl': 'https://jimaku.cc/entry/1/download/a.exe', 'filename': 'a.exe',
        })
