from backend.services import anki_highlight_store as store


def configure_paths(monkeypatch, tmp_path):
    highlight_dir = tmp_path / "highlight"
    frontend_dir = tmp_path / "frontend"
    frontend_dir.mkdir()
    monkeypatch.setattr(store, "ANKI_HIGHLIGHT_DIR", highlight_dir)
    monkeypatch.setattr(store, "FRONTEND_DIR", frontend_dir)
    return highlight_dir, frontend_dir


def test_known_basic_words_migrate_from_legacy_location(monkeypatch, tmp_path):
    highlight_dir, frontend_dir = configure_paths(monkeypatch, tmp_path)
    (frontend_dir / "known-basic-words.json").write_text('["猫", "猫", " 犬 "]', encoding="utf-8")

    path = store.known_basic_words_path()

    assert path == highlight_dir / "known-basic-words.json"
    assert store.read_words_file(path) == ["猫", "犬"]


def test_highlight_settings_are_normalized(monkeypatch, tmp_path):
    configure_paths(monkeypatch, tmp_path)
    saved = store.write_anki_highlight_settings({
        "ankiUrl": " http://localhost:8765 ",
        "decks": [" Mining ", ""],
        "wordFields": [" Word "],
        "autoRefresh": "invalid",
    })

    assert saved["ankiUrl"] == "http://localhost:8765"
    assert saved["decks"] == ["Mining"]
    assert saved["wordFields"] == ["Word"]
    assert saved["autoRefresh"] == "daily"
    assert store.read_anki_highlight_settings() == saved


def test_ensure_highlight_files_creates_defaults(monkeypatch, tmp_path):
    configure_paths(monkeypatch, tmp_path)
    store.ensure_anki_highlight_files()
    assert store.known_basic_words_path().exists() is False
    assert store.known_anki_words_path().exists()
    assert store.anki_highlight_settings_path().exists()
