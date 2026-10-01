import json
import logging

from backend.settings import Settings, current_settings


def _settings(settings: Settings | None) -> Settings:
    return settings or current_settings()


def _anki_highlight_file(filename: str, settings: Settings | None = None):
    directory = _settings(settings).anki_highlight_dir
    directory.mkdir(parents=True, exist_ok=True)
    return directory / filename


def _legacy_known_basic_path(settings: Settings | None = None):
    return _settings(settings).frontend_dir / "known-basic-words.json"


def read_words_file(path):
    if not path.exists():
        return []

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("words"), list):
        return data["words"]
    raise ValueError(f"Invalid {path.name} format")


def write_words_file(path, words):
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized_words = []
    seen = set()
    for item in words:
        word = str(item).strip()
        if not word or word in seen:
            continue
        seen.add(word)
        normalized_words.append(word)

    path.write_text(json.dumps(normalized_words, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized_words


def known_basic_words_path(settings: Settings | None = None):
    target = _anki_highlight_file("known-basic-words.json", settings)
    legacy = _legacy_known_basic_path(settings)

    if not target.exists() and legacy.exists():
        try:
            words = read_words_file(legacy)
            write_words_file(target, words)
        except Exception:
            logging.getLogger(__name__).exception("Could not import legacy known words")

    return target


def known_anki_words_path(settings: Settings | None = None):
    return _anki_highlight_file("known-anki-words.json", settings)


def anki_highlight_settings_path(settings: Settings | None = None):
    return _anki_highlight_file("anki-highlight-settings.json", settings)


def read_anki_highlight_settings(settings: Settings | None = None) -> dict:
    path = anki_highlight_settings_path(settings)
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def write_anki_highlight_settings(payload: dict, settings: Settings | None = None) -> dict:
    normalized = {
        "ankiUrl": str(payload.get("ankiUrl") or "").strip(),
        "decks": [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()],
        "wordFields": [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()],
        "sentenceFields": [str(item).strip() for item in payload.get("sentenceFields") or [] if str(item).strip()],
        "autoRefresh": str(payload.get("autoRefresh") or "daily").strip().lower(),
        "lastManualRefreshAt": payload.get("lastManualRefreshAt"),
        "lastAutoRefreshAt": payload.get("lastAutoRefreshAt"),
        "lastAutoRefreshError": payload.get("lastAutoRefreshError"),
        "lastAutoRefreshResult": payload.get("lastAutoRefreshResult"),
        "lastStartupStaleCheckAt": payload.get("lastStartupStaleCheckAt"),
        "lastStartupStaleCheckResult": payload.get("lastStartupStaleCheckResult"),
        "lastPlayerStaleCheckAt": payload.get("lastPlayerStaleCheckAt"),
        "lastPlayerStaleCheckResult": payload.get("lastPlayerStaleCheckResult"),
    }
    if normalized["autoRefresh"] not in {"off", "daily", "weekly"}:
        normalized["autoRefresh"] = "daily"
    path = anki_highlight_settings_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def merge_refresh_payload_with_saved_settings(payload: dict, settings: Settings | None = None) -> dict:
    saved = read_anki_highlight_settings(settings)
    merged = dict(saved)
    merged.update({key: value for key, value in payload.items() if value is not None})
    return merged


def enrich_cached_word_metadata(info: dict, card_ids: list[int], fields: dict) -> dict:
    """Add report metadata without changing the cached learning status."""
    return {
        **(info if isinstance(info, dict) else {}),
        "cardIds": list(card_ids),
        "fields": fields if isinstance(fields, dict) else {},
    }



def _default_known_anki_data():
    return {
        "updatedAt": None,
        "decks": [],
        "wordFields": [],
        "sentenceFields": [],
        "words": {},
    }


def read_known_anki_data(settings: Settings | None = None) -> dict:
    path = known_anki_words_path(settings)
    if not path.exists():
        return _default_known_anki_data()

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Invalid known-anki-words.json format")

    words = data.get("words")
    if not isinstance(words, dict):
        raise ValueError("Invalid known-anki-words.json format")

    return {
        "updatedAt": data.get("updatedAt"),
        "decks": data.get("decks") if isinstance(data.get("decks"), list) else [],
        "wordFields": data.get("wordFields") if isinstance(data.get("wordFields"), list) else [],
        "sentenceFields": data.get("sentenceFields") if isinstance(data.get("sentenceFields"), list) else [],
        "words": words,
    }


def write_known_anki_data(data: dict, settings: Settings | None = None) -> dict:
    path = known_anki_words_path(settings)
    normalized = {
        "updatedAt": data.get("updatedAt"),
        "decks": data.get("decks") if isinstance(data.get("decks"), list) else [],
        "wordFields": data.get("wordFields") if isinstance(data.get("wordFields"), list) else [],
        "sentenceFields": data.get("sentenceFields") if isinstance(data.get("sentenceFields"), list) else [],
        "words": data.get("words") if isinstance(data.get("words"), dict) else {},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def ensure_anki_highlight_files(settings: Settings | None = None) -> None:
    known_basic_words_path(settings)
    known_anki_path = known_anki_words_path(settings)
    if not known_anki_path.exists():
        write_known_anki_data(_default_known_anki_data(), settings)
    if not anki_highlight_settings_path(settings).exists():
        write_anki_highlight_settings({"autoRefresh": "daily"}, settings)
