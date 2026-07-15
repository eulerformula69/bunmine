import json

from backend.config import ANKI_HIGHLIGHT_DIR, FRONTEND_DIR

def _anki_highlight_file(filename: str):
    ANKI_HIGHLIGHT_DIR.mkdir(parents=True, exist_ok=True)
    return ANKI_HIGHLIGHT_DIR / filename


def _legacy_known_basic_path():
    return FRONTEND_DIR / "known-basic-words.json"


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


def known_basic_words_path():
    target = _anki_highlight_file("known-basic-words.json")
    legacy = _legacy_known_basic_path()

    if not target.exists() and legacy.exists():
        try:
            words = read_words_file(legacy)
            write_words_file(target, words)
        except Exception:
            # Let the route below surface the legacy parse error if needed.
            pass

    return target


def known_anki_words_path():
    return _anki_highlight_file("known-anki-words.json")


def anki_highlight_settings_path():
    return _anki_highlight_file("anki-highlight-settings.json")


def read_anki_highlight_settings() -> dict:
    path = anki_highlight_settings_path()
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def write_anki_highlight_settings(payload: dict) -> dict:
    settings = {
        "ankiUrl": str(payload.get("ankiUrl") or "").strip(),
        "decks": [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()],
        "wordFields": [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()],
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
    if settings["autoRefresh"] not in {"off", "daily", "weekly"}:
        settings["autoRefresh"] = "daily"
    path = anki_highlight_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
    return settings


def merge_refresh_payload_with_saved_settings(payload: dict) -> dict:
    saved = read_anki_highlight_settings()
    merged = dict(saved)
    merged.update({key: value for key, value in payload.items() if value is not None})
    return merged



def _default_known_anki_data():
    return {
        "updatedAt": None,
        "decks": [],
        "wordFields": [],
        "words": {},
    }


def read_known_anki_data() -> dict:
    path = known_anki_words_path()
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
        "words": words,
    }


def write_known_anki_data(data: dict) -> dict:
    path = known_anki_words_path()
    normalized = {
        "updatedAt": data.get("updatedAt"),
        "decks": data.get("decks") if isinstance(data.get("decks"), list) else [],
        "wordFields": data.get("wordFields") if isinstance(data.get("wordFields"), list) else [],
        "words": data.get("words") if isinstance(data.get("words"), dict) else {},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def ensure_anki_highlight_files() -> None:
    known_basic_words_path()
    known_anki_path = known_anki_words_path()
    if not known_anki_path.exists():
        write_known_anki_data(_default_known_anki_data())
    if not anki_highlight_settings_path().exists():
        write_anki_highlight_settings({"autoRefresh": "daily"})


