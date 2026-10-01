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
