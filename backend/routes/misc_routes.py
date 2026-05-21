import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from backend import app_state
from backend.config import ANKI_HIGHLIGHT_DIR, FRONTEND_DIR
from backend.utils_validation import safe_cache_key

misc_bp = Blueprint("misc", __name__)

KNOWN_ANKI_DEFAULT = {
    "updatedAt": None,
    "decks": [],
    "wordFields": [],
    "words": {},
}

STATUS_PRIORITY = {
    "mature": 5,
    "young": 4,
    "learning": 3,
    "new": 2,
    "suspended": 1,
    "unknown": 0,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _anki_highlight_file(filename: str):
    ANKI_HIGHLIGHT_DIR.mkdir(parents=True, exist_ok=True)
    return ANKI_HIGHLIGHT_DIR / filename


def _legacy_known_basic_path():
    return FRONTEND_DIR / "known-basic-words.json"


def _read_words_file(path):
    if not path.exists():
        return []

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("words"), list):
        return data["words"]
    raise ValueError(f"Invalid {path.name} format")


def _write_words_file(path, words):
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


def _known_basic_words_path():
    target = _anki_highlight_file("known-basic-words.json")
    legacy = _legacy_known_basic_path()

    if not target.exists() and legacy.exists():
        try:
            words = _read_words_file(legacy)
            _write_words_file(target, words)
        except Exception:
            # Let the route below surface the legacy parse error if needed.
            pass

    return target


def _known_anki_words_path():
    return _anki_highlight_file("known-anki-words.json")


def _anki_highlight_settings_path():
    return _anki_highlight_file("anki-highlight-settings.json")


def _read_anki_highlight_settings() -> dict:
    path = _anki_highlight_settings_path()
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _write_anki_highlight_settings(payload: dict) -> dict:
    settings = {
        "ankiUrl": str(payload.get("ankiUrl") or "").strip(),
        "decks": [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()],
        "wordFields": [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()],
        "autoRefresh": str(payload.get("autoRefresh") or "daily").strip().lower(),
        "lastManualRefreshAt": payload.get("lastManualRefreshAt"),
        "lastAutoRefreshAt": payload.get("lastAutoRefreshAt"),
        "lastAutoRefreshError": payload.get("lastAutoRefreshError"),
    }
    if settings["autoRefresh"] not in {"off", "daily", "weekly"}:
        settings["autoRefresh"] = "daily"
    path = _anki_highlight_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
    return settings


def _merge_refresh_payload_with_saved_settings(payload: dict) -> dict:
    saved = _read_anki_highlight_settings()
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


def _read_known_anki_data() -> dict:
    path = _known_anki_words_path()
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


def _write_known_anki_data(data: dict) -> dict:
    path = _known_anki_words_path()
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
    _known_basic_words_path()
    known_anki_path = _known_anki_words_path()
    if not known_anki_path.exists():
        _write_known_anki_data(_default_known_anki_data())
    if not _anki_highlight_settings_path().exists():
        _write_anki_highlight_settings({"autoRefresh": "daily"})


def _normalize_highlight_word(value) -> str:
    # Keep this intentionally close to the browser normalizer: remove HTML-ish field markup,
    # collapse whitespace, and keep the actual Japanese spelling unchanged.
    text = str(value or "")
    while "<" in text and ">" in text:
        before = text
        start = text.find("<")
        end = text.find(">", start)
        if start < 0 or end < 0:
            break
        text = text[:start] + " " + text[end + 1:]
        if text == before:
            break
    return " ".join(text.split()).strip()


def _pick_better_status(old_status, new_status):
    old_status = str(old_status or "")
    new_status = str(new_status or "unknown")
    return new_status if STATUS_PRIORITY.get(new_status, 0) > STATUS_PRIORITY.get(old_status, 0) else old_status


def _card_status(card: dict) -> str:
    if card.get("queue") == -1:
        return "suspended"
    if card.get("type") == 0:
        return "new"
    if card.get("type") == 1 or card.get("queue") in {1, 3}:
        return "learning"

    interval = card.get("interval", card.get("ivl", 0))
    try:
        interval = float(interval or 0)
    except (TypeError, ValueError):
        interval = 0

    return "mature" if interval >= 21 else "young"


def _chunked(items, size: int):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def _anki_request(anki_url: str, action: str, params: dict | None = None):
    body = json.dumps({"action": action, "version": 6, "params": params or {}}).encode("utf-8")
    req = urllib.request.Request(
        anki_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as err:
        reason = getattr(err, "reason", err)
        raise RuntimeError(f"Cannot reach AnkiConnect at {anki_url}. Make sure Anki is open and AnkiConnect is installed. Details: {reason}") from err
    except TimeoutError as err:
        raise RuntimeError(f"AnkiConnect request timed out while running {action}.") from err

    if data.get("error"):
        raise RuntimeError(f"AnkiConnect {action} failed: {data['error']}")
    return data.get("result")


def _escape_anki_search_value(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')


def _build_deck_query(deck_names: list[str]) -> str:
    return " OR ".join(f'deck:"{_escape_anki_search_value(deck)}"' for deck in deck_names if deck)


def _refresh_known_anki_words_from_anki(payload: dict) -> dict:
    anki_url = str(payload.get("ankiUrl") or "").strip()
    deck_names = [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()]
    word_fields = [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()]
    full_rebuild = bool(payload.get("fullRebuild"))

    if not anki_url:
        raise ValueError("ankiUrl is required")
    if not deck_names:
        raise ValueError("At least one deck is required")
    if not word_fields:
        raise ValueError("At least one word field is required")

    auto_refresh = str(payload.get("autoRefresh") or "daily").strip().lower()
    if auto_refresh not in {"off", "daily", "weekly"}:
        auto_refresh = "daily"

    checked_at = _utc_now_iso()
    saved_settings = _read_anki_highlight_settings()
    _write_anki_highlight_settings({
        **saved_settings,
        "ankiUrl": anki_url,
        "decks": deck_names,
        "wordFields": word_fields,
        "autoRefresh": auto_refresh,
        "lastManualRefreshAt": checked_at if not payload.get("autoRun") else saved_settings.get("lastManualRefreshAt"),
        "lastAutoRefreshAt": checked_at if payload.get("autoRun") else saved_settings.get("lastAutoRefreshAt"),
        "lastAutoRefreshError": None,
    })
    previous = _read_known_anki_data()
    previous_words = previous.get("words", {}) if isinstance(previous.get("words"), dict) else {}
    next_words = {} if full_rebuild else dict(previous_words)

    deck_query = _build_deck_query(deck_names)
    card_ids = _anki_request(anki_url, "findCards", {"query": f"({deck_query})"}) or []

    note_status_map: dict[str, str] = {}
    for card_chunk in _chunked(card_ids, 500):
        cards_info = _anki_request(anki_url, "cardsInfo", {"cards": card_chunk}) or []
        for card in cards_info:
            note_id = str(card.get("note") or "").strip()
            if not note_id:
                continue
            note_status_map[note_id] = _pick_better_status(note_status_map.get(note_id), _card_status(card))

    note_ids = []
    for raw_note_id in note_status_map.keys():
        try:
            note_ids.append(int(raw_note_id))
        except ValueError:
            continue

    imported_words = 0
    preserved_locked_words = 0

    for note_chunk in _chunked(note_ids, 250):
        notes_info = _anki_request(anki_url, "notesInfo", {"notes": note_chunk}) or []
        for note in notes_info:
            note_id = note.get("noteId")
            status = note_status_map.get(str(note_id), "unknown")
            fields = note.get("fields") if isinstance(note.get("fields"), dict) else {}

            for field_name in word_fields:
                field = fields.get(field_name) if isinstance(fields.get(field_name), dict) else {}
                word = _normalize_highlight_word(field.get("value"))
                if not word:
                    continue

                old_info = previous_words.get(word) if isinstance(previous_words.get(word), dict) else {}
                if old_info.get("locked") is True and old_info.get("status") == "mature" and not full_rebuild:
                    next_words[word] = old_info
                    preserved_locked_words += 1
                    continue

                old_next_info = next_words.get(word) if isinstance(next_words.get(word), dict) else {}
                best_status = _pick_better_status(old_next_info.get("status"), status)

                next_words[word] = {
                    **old_next_info,
                    "status": best_status,
                    "noteId": int(note_id) if note_id is not None else None,
                    "lastCheckedAt": checked_at,
                    "locked": best_status == "mature",
                }
                imported_words += 1

    result_data = _write_known_anki_data({
        "updatedAt": checked_at,
        "decks": deck_names,
        "wordFields": word_fields,
        "words": next_words,
    })

    return {
        "ok": True,
        "updatedAt": checked_at,
        "source": str(_known_anki_words_path()),
        "count": len(result_data["words"]),
        "cardsChecked": len(card_ids),
        "notesChecked": len(note_ids),
        "importedWords": imported_words,
        "preservedLockedWords": preserved_locked_words,
        "fullRebuild": full_rebuild,
    }


@misc_bp.route("/heartbeat", methods=["POST"])
def heartbeat():
    app_state.last_heartbeat = time.time()
    return jsonify({"status": "alive"})


@misc_bp.route("/anki-highlight-cache/<cache_key>", methods=["GET"])
def get_anki_highlight_cache(cache_key):
    try:
        safe_key = safe_cache_key(cache_key)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    cache_path = ANKI_HIGHLIGHT_DIR / f"{safe_key}.json"
    if not cache_path.exists():
        return jsonify({"found": False})

    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return jsonify({"found": True, "data": data})
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@misc_bp.route("/anki-highlight-cache/<cache_key>", methods=["POST"])
def save_anki_highlight_cache(cache_key):
    try:
        safe_key = safe_cache_key(cache_key)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid cache payload"}), 400

    cache_path = ANKI_HIGHLIGHT_DIR / f"{safe_key}.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return jsonify({"success": True})


@misc_bp.route("/known-basic-words", methods=["GET"])
def get_known_basic_words():
    words_path = _known_basic_words_path()
    if not words_path.exists():
        return jsonify({"words": [], "source": str(words_path), "exists": False})

    try:
        return jsonify({"words": _read_words_file(words_path), "source": str(words_path), "exists": True})
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@misc_bp.route("/known-basic-words/add", methods=["POST"])
def add_known_basic_word():
    words_path = _known_basic_words_path()
    data = request.get_json(silent=True) or {}
    word = str(data.get("word", "")).strip()
    if not word:
        return jsonify({"error": "Word is required"}), 400
    if len(word) > 80:
        return jsonify({"error": "Word is too long"}), 400

    try:
        words = _read_words_file(words_path) if words_path.exists() else []
        before = {str(item).strip() for item in words if str(item).strip()}
        normalized_words = _write_words_file(words_path, [*words, word])
        return jsonify({
            "ok": True,
            "word": word,
            "added": word not in before,
            "count": len(normalized_words),
            "source": str(words_path),
        })
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@misc_bp.route("/known-anki-words", methods=["GET"])
def get_known_anki_words():
    try:
        data = _read_known_anki_data()
        if not _known_anki_words_path().exists():
            data = _write_known_anki_data(data)
        return jsonify({"found": True, "data": data, "source": str(_known_anki_words_path())})
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@misc_bp.route("/known-anki-words", methods=["POST"])
def save_known_anki_words():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict) or not isinstance(data.get("words"), dict):
        return jsonify({"error": "Invalid known-anki-words payload"}), 400

    try:
        saved = _write_known_anki_data(data)
        return jsonify({"ok": True, "source": str(_known_anki_words_path()), "count": len(saved.get("words", {}))})
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@misc_bp.route("/known-anki-words/auto-refresh-settings", methods=["GET"])
def get_known_anki_auto_refresh_settings():
    try:
        settings = _read_anki_highlight_settings()
        safe_settings = {key: value for key, value in settings.items() if key != "ankiUrl"}
        safe_settings["hasAnkiUrl"] = bool(settings.get("ankiUrl"))
        return jsonify({"ok": True, "settings": safe_settings, "source": str(_anki_highlight_settings_path())})
    except Exception as err:
        return jsonify({"error": str(err)}), 500


def refresh_known_anki_words_auto() -> dict:
    payload = _merge_refresh_payload_with_saved_settings({
        "fullRebuild": False,
        "autoRun": True,
    })
    if not payload.get("ankiUrl") or not payload.get("decks") or not payload.get("wordFields"):
        return {"ok": False, "skipped": True, "reason": "Run Refresh Highlight Words once manually to save Anki URL, decks and word fields."}
    try:
        return _refresh_known_anki_words_from_anki(payload)
    except Exception as err:
        settings = _read_anki_highlight_settings()
        _write_anki_highlight_settings({
            **settings,
            "lastAutoRefreshError": str(err),
        })
        raise


@misc_bp.route("/known-anki-words/refresh", methods=["POST"])
def refresh_known_anki_words():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid refresh payload"}), 400

    payload = _merge_refresh_payload_with_saved_settings(payload)

    try:
        return jsonify(_refresh_known_anki_words_from_anki(payload))
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500
