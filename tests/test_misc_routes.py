from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.app import create_app
from backend.services import anki_highlight_store as store


@pytest.mark.parametrize("path", [
    "/known-basic-words", "/known-anki-words", "/known-anki-words/auto-refresh-settings",
])
def test_corrupt_store_errors_use_shared_handler(temporary_settings, path):
    filenames = {
        "/known-basic-words": "known-basic-words.json",
        "/known-anki-words": "known-anki-words.json",
        "/known-anki-words/auto-refresh-settings": "anki-highlight-settings.json",
    }
    temporary_settings.anki_highlight_dir.mkdir(parents=True)
    file = temporary_settings.anki_highlight_dir / filenames[path]
    file.write_text("broken json", encoding="utf-8")
    client = create_app(temporary_settings, initialize=False).test_client()
    response = client.get(path)
    assert response.status_code == 400
    assert response.json["error"]["message"] == "Invalid request"
    assert response.json["error"]["requestId"] == response.headers["X-Request-ID"]
    assert file.read_text(encoding="utf-8") == "broken json"


def test_concurrent_basic_word_additions_are_not_lost(temporary_settings):
    app = create_app(temporary_settings, initialize=False)

    def add(index):
        with app.test_client() as client:
            return client.post("/known-basic-words/add", json={"word": f"word-{index}"}).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(add, range(24))) == [200] * 24
    words = store.read_words_file(store.known_basic_words_path(temporary_settings))
    assert set(words) == {f"word-{index}" for index in range(24)}


def test_cache_write_failure_uses_shared_handler(temporary_settings, monkeypatch):
    def fail(*_args):
        raise OSError("private disk path")

    monkeypatch.setattr(store.os, "replace", fail)
    client = create_app(temporary_settings, initialize=False).test_client()
    response = client.post("/anki-highlight-cache/test-cache", json={"words": []})
    assert response.status_code == 500
    assert response.json["error"]["message"] == "Request failed"
    assert "private disk path" not in response.get_data(as_text=True)
