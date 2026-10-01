import json
import logging
import os
import tempfile
from functools import wraps
from pathlib import Path
from threading import RLock

from backend.settings import Settings, current_settings


SCHEMA_VERSION = 1
# The desktop server has one process. Hold this lock for each complete update.
store_lock = RLock()


def serialized_store_update(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with store_lock:
            return function(*args, **kwargs)
    return wrapped


@serialized_store_update
def write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temporary_path = Path(handle.name)
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _read_json(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError(f"Invalid JSON in {path.name}. The original file was kept") from error
    if isinstance(data, dict):
        version = data.get("schemaVersion", 0)
        if type(version) is not int or version not in (0, SCHEMA_VERSION):
            raise ValueError(f"Unsupported schema version in {path.name}: {version}")
    return data


def _write_versioned_json(path: Path, data: dict) -> None:
    if path.exists():
        _read_json(path)
    write_json_atomic(path, {"schemaVersion": SCHEMA_VERSION, **data})

def _settings(settings: Settings | None) -> Settings:
    return settings or current_settings()


def _anki_highlight_file(filename: str, settings: Settings | None = None):
    directory = _settings(settings).anki_highlight_dir
    directory.mkdir(parents=True, exist_ok=True)
    return directory / filename


def _legacy_known_basic_path(settings: Settings | None = None):
    return _settings(settings).frontend_dir / "known-basic-words.json"


@serialized_store_update
def read_words_file(path):
    if not path.exists():
        return []

    data = _read_json(path)
    if isinstance(data, list):
        return _normalize_words(data)
    if isinstance(data, dict) and isinstance(data.get("words"), list):
        return _normalize_words(data["words"])
    raise ValueError(f"Invalid {path.name} format")


def _normalize_words(words):
    normalized_words = []
    seen = set()
    for item in words:
        word = str(item).strip()
        if not word or word in seen:
            continue
        seen.add(word)
        normalized_words.append(word)

    return normalized_words


@serialized_store_update
def write_words_file(path, words):
    normalized_words = _normalize_words(words)
    _write_versioned_json(path, {"words": normalized_words})
    return normalized_words


@serialized_store_update
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


@serialized_store_update
def read_anki_highlight_settings(settings: Settings | None = None) -> dict:
    path = anki_highlight_settings_path(settings)
    if not path.exists():
        return {}
    data = _read_json(path)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid {path.name} format")
    return normalize_highlight_settings(data)


def _normalize_setting_list(payload: dict, key: str) -> list[str]:
    items = payload.get(key)
    if items is None:
        return []
    if not isinstance(items, list):
        raise ValueError(f"{key} must be a list")
    return [str(item).strip() for item in items if str(item).strip()]


def normalize_highlight_settings(payload: dict) -> dict:
    normalized = {
        "ankiUrl": str(payload.get("ankiUrl") or "").strip(),
        "decks": _normalize_setting_list(payload, "decks"),
        "wordFields": _normalize_setting_list(payload, "wordFields"),
        "sentenceFields": _normalize_setting_list(payload, "sentenceFields"),
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
    return normalized


@serialized_store_update
def write_anki_highlight_settings(payload: dict, settings: Settings | None = None) -> dict:
    normalized = normalize_highlight_settings(payload)
    _write_versioned_json(anki_highlight_settings_path(settings), normalized)
    return normalized


@serialized_store_update
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


@serialized_store_update
def read_known_anki_data(settings: Settings | None = None) -> dict:
    path = known_anki_words_path(settings)
    if not path.exists():
        return _default_known_anki_data()

    data = _read_json(path)
    if not isinstance(data, dict):
        raise ValueError("Invalid known-anki-words.json format")

    words = data.get("words")
    if not isinstance(words, dict):
        raise ValueError("Invalid known-anki-words.json format")

    return _normalize_known_anki_data(data)


def _normalize_known_anki_data(data: dict) -> dict:
    return {
        "updatedAt": data.get("updatedAt"),
        "decks": data.get("decks") if isinstance(data.get("decks"), list) else [],
        "wordFields": data.get("wordFields") if isinstance(data.get("wordFields"), list) else [],
        "sentenceFields": data.get("sentenceFields") if isinstance(data.get("sentenceFields"), list) else [],
        "words": data.get("words") if isinstance(data.get("words"), dict) else {},
    }


@serialized_store_update
def write_known_anki_data(data: dict, settings: Settings | None = None) -> dict:
    normalized = _normalize_known_anki_data(data)
    _write_versioned_json(known_anki_words_path(settings), normalized)
    return normalized


@serialized_store_update
def ensure_anki_highlight_files(settings: Settings | None = None) -> None:
    known_basic_words_path(settings)
    known_anki_path = known_anki_words_path(settings)
    if not known_anki_path.exists():
        write_known_anki_data(_default_known_anki_data(), settings)
    if not anki_highlight_settings_path(settings).exists():
        write_anki_highlight_settings({"autoRefresh": "daily"}, settings)
