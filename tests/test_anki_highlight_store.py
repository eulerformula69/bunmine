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
