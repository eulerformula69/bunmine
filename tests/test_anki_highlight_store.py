import json

import pytest

from backend.services import anki_highlight_store as store


def test_known_basic_words_migrate_from_legacy_location(temporary_settings):
    temporary_settings.frontend_dir.mkdir()
    legacy_path = temporary_settings.frontend_dir / "known-basic-words.json"
    legacy_path.write_text('["猫", "猫", " 犬 "]', encoding="utf-8")

    path = store.known_basic_words_path(temporary_settings)

    assert path == temporary_settings.anki_highlight_dir / "known-basic-words.json"
    assert store.read_words_file(path) == ["猫", "犬"]


def test_highlight_settings_are_normalized(temporary_settings):
    saved = store.write_anki_highlight_settings({
        "ankiUrl": " http://localhost:8765 ",
        "decks": [" Mining ", ""],
        "wordFields": [" Word "],
        "autoRefresh": "invalid",
    }, temporary_settings)

    assert saved["ankiUrl"] == "http://localhost:8765"
    assert saved["decks"] == ["Mining"]
    assert saved["wordFields"] == ["Word"]
    assert saved["autoRefresh"] == "daily"
    assert store.read_anki_highlight_settings(temporary_settings) == saved


def test_ensure_highlight_files_creates_defaults(temporary_settings):
    store.ensure_anki_highlight_files(temporary_settings)
    assert store.known_basic_words_path(temporary_settings).exists() is False
    assert store.known_anki_words_path(temporary_settings).exists()
    assert store.anki_highlight_settings_path(temporary_settings).exists()


def test_enrich_locked_word_metadata_preserves_status():
    old = {"status": "mature", "locked": True, "noteId": 42, "lastCheckedAt": "old"}
    result = store.enrich_cached_word_metadata(
        old,
        [101, 102],
        {"Sentence": {"value": "<b>日本語の例文</b>"}},
    )
    assert result["status"] == "mature"
    assert result["locked"] is True
    assert result["noteId"] == 42
    assert result["cardIds"] == [101, 102]
    assert result["fields"]["Sentence"]["value"] == "<b>日本語の例文</b>"


@pytest.mark.parametrize("failure", ["replace", "fsync", "serialization"])
def test_failed_atomic_write_keeps_original_and_removes_temporary_file(tmp_path, monkeypatch, failure):
    path = tmp_path / "words.json"
    path.write_text('["猫"]', encoding="utf-8")
    original = path.read_bytes()

    def fail(*_args):
        raise OSError("disk error")

    data = {"words": {object()}} if failure == "serialization" else {"words": ["犬"]}
    if failure != "serialization":
        monkeypatch.setattr(store.os, failure, fail)
    with pytest.raises((OSError, TypeError)):
        store.write_json_atomic(path, data)
    assert path.read_bytes() == original
    assert list(tmp_path.iterdir()) == [path]


def test_legacy_json_is_normalized_and_versioned_on_next_write(temporary_settings):
    path = store.anki_highlight_settings_path(temporary_settings)
    path.write_text('{"decks": [" Mining "], "autoRefresh": "OFF"}', encoding="utf-8")
    data = store.read_anki_highlight_settings(temporary_settings)
    assert data["decks"] == ["Mining"]
    assert data["autoRefresh"] == "off"
    store.write_anki_highlight_settings(data, temporary_settings)
    assert json.loads(path.read_text(encoding="utf-8"))["schemaVersion"] == 1


@pytest.mark.parametrize("content", ['{"words":', '{"schemaVersion": 99, "words": {}}'])
def test_corrupt_or_future_data_is_not_overwritten(temporary_settings, content):
    path = store.known_anki_words_path(temporary_settings)
    path.write_text(content, encoding="utf-8")
    with pytest.raises(ValueError):
        store.read_known_anki_data(temporary_settings)
    with pytest.raises(ValueError):
        store.write_known_anki_data({"words": {}}, temporary_settings)
    assert path.read_text(encoding="utf-8") == content
