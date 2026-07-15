import json
import time
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from backend import app_state
from backend.config import ANKI_HIGHLIGHT_DIR, FRONTEND_DIR
from backend.services.anki_client import (
    build_deck_query as _build_deck_query,
    chunked as _chunked,
    extract_words_from_note,
    note_card_ids as _note_card_ids,
    request as _anki_request,
)
from backend.services.anki_highlight_store import (
    anki_highlight_settings_path as _anki_highlight_settings_path,
    ensure_anki_highlight_files,
    known_basic_words_path as _known_basic_words_path,
    known_anki_words_path as _known_anki_words_path,
    merge_refresh_payload_with_saved_settings as _merge_refresh_payload_with_saved_settings,
    read_anki_highlight_settings as _read_anki_highlight_settings,
    read_known_anki_data as _read_known_anki_data,
    read_words_file as _read_words_file,
    write_anki_highlight_settings as _write_anki_highlight_settings,
    write_known_anki_data as _write_known_anki_data,
    write_words_file as _write_words_file,
)
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


def _parse_utc_iso(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _settings_refresh_anchor(settings: dict):
    auto_at = _parse_utc_iso(settings.get("lastAutoRefreshAt"))
    manual_at = _parse_utc_iso(settings.get("lastManualRefreshAt"))
    candidates = [item for item in [auto_at, manual_at] if item is not None]
    return max(candidates) if candidates else None


def _is_auto_refresh_stale(settings: dict) -> bool:
    mode = str(settings.get("autoRefresh") or "off").strip().lower()
    if mode == "off":
        return False
    if mode not in {"daily", "weekly"}:
        return False

    # First startup after selecting daily/weekly should run once, because there is no saved anchor yet.
    anchor = _settings_refresh_anchor(settings)
    if anchor is None:
        return True

    interval = timedelta(days=7 if mode == "weekly" else 1)
    now = datetime.now(timezone.utc)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    return now - anchor >= interval

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

    # Fast path:
    #   1. findNotes is cheaper than findCards for discovery.
    #   2. notesInfo gives fields and card ids together.
    #   3. cardsInfo is requested only for notes that contain new/non-locked words.
    # Locked mature words are preserved without status re-checks unless fullRebuild is requested.
    deck_query = _build_deck_query(deck_names)
    note_ids = _anki_request(anki_url, "findNotes", {"query": f"({deck_query})"}) or []

    note_words: dict[str, list[str]] = {}
    note_cards: dict[str, list[int]] = {}
    card_to_note: dict[int, str] = {}
    candidate_card_ids: list[int] = []
    discovered_words = 0
    preserved_locked_words = 0

    for note_chunk in _chunked(note_ids, 250):
        notes_info = _anki_request(anki_url, "notesInfo", {"notes": note_chunk}) or []
        for note in notes_info:
            note_id = str(note.get("noteId") or "").strip()
            if not note_id:
                continue

            words = extract_words_from_note(note, word_fields, _normalize_highlight_word)
            if not words:
                continue

            card_ids = _note_card_ids(note)
            note_words[note_id] = words
            note_cards[note_id] = card_ids
            discovered_words += len(words)

            needs_status_check = full_rebuild
            if not needs_status_check:
                for word in words:
                    old_info = previous_words.get(word) if isinstance(previous_words.get(word), dict) else {}
                    if old_info.get("locked") is True and old_info.get("status") == "mature":
                        next_words[word] = old_info
                        preserved_locked_words += 1
                    else:
                        needs_status_check = True

            if not needs_status_check:
                continue

            for card_id in card_ids:
                card_to_note[card_id] = note_id
                candidate_card_ids.append(card_id)

    note_status_map: dict[str, str] = {}
    for card_chunk in _chunked(candidate_card_ids, 500):
        cards_info = _anki_request(anki_url, "cardsInfo", {"cards": card_chunk}) or []
        for card in cards_info:
            try:
                card_id = int(card.get("cardId") or card.get("cardId") or card.get("id"))
            except (TypeError, ValueError):
                # Some AnkiConnect versions omit cardId in cardsInfo. Fall back to the note id in payload.
                card_id = None

            note_id = ""
            if card_id is not None:
                note_id = card_to_note.get(card_id, "")
            if not note_id:
                note_id = str(card.get("note") or "").strip()
            if not note_id:
                continue

            note_status_map[note_id] = _pick_better_status(note_status_map.get(note_id), _card_status(card))

    imported_words = 0
    skipped_locked_words = 0
    status_checked_notes = 0

    for note_id, words in note_words.items():
        if note_id not in note_status_map:
            skipped_locked_words += len(words)
            continue

        status_checked_notes += 1
        status = note_status_map.get(note_id, "unknown")
        for word in words:
            old_info = previous_words.get(word) if isinstance(previous_words.get(word), dict) else {}
            if old_info.get("locked") is True and old_info.get("status") == "mature" and not full_rebuild:
                next_words[word] = old_info
                continue

            old_next_info = next_words.get(word) if isinstance(next_words.get(word), dict) else {}
            best_status = _pick_better_status(old_next_info.get("status"), status)

            try:
                normalized_note_id = int(note_id)
            except ValueError:
                normalized_note_id = None

            next_words[word] = {
                **old_next_info,
                "status": best_status,
                "noteId": normalized_note_id,
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
        "notesFound": len(note_ids),
        "notesChecked": status_checked_notes,
        "cardsChecked": len(candidate_card_ids),
        "discoveredWords": discovered_words,
        "importedWords": imported_words,
        "preservedLockedWords": preserved_locked_words,
        "skippedLockedWords": skipped_locked_words,
        "fullRebuild": full_rebuild,
        "optimized": True,
    }



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


@misc_bp.route("/known-anki-words/auto-refresh-settings", methods=["POST"])
def save_known_anki_auto_refresh_settings():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid auto-refresh settings payload"}), 400

    saved = _read_anki_highlight_settings()
    merged = {**saved}

    if "ankiUrl" in payload:
        merged["ankiUrl"] = str(payload.get("ankiUrl") or "").strip()
    if "decks" in payload:
        merged["decks"] = [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()]
    if "wordFields" in payload:
        merged["wordFields"] = [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()]
    if "autoRefresh" in payload:
        merged["autoRefresh"] = str(payload.get("autoRefresh") or "off").strip().lower()

    try:
        settings = _write_anki_highlight_settings(merged)
        safe_settings = {key: value for key, value in settings.items() if key != "ankiUrl"}
        safe_settings["hasAnkiUrl"] = bool(settings.get("ankiUrl"))
        return jsonify({"ok": True, "settings": safe_settings, "source": str(_anki_highlight_settings_path())})
    except Exception as err:
        return jsonify({"error": str(err)}), 500


def _compact_refresh_result(result: dict) -> dict:
    """Persist a small, readable summary in anki-highlight-settings.json."""
    if not isinstance(result, dict):
        return {"ok": False, "reason": "Invalid refresh result"}
    keep = [
        "ok", "skipped", "reason", "count", "notesFound", "notesChecked",
        "cardsChecked", "discoveredWords", "importedWords",
        "preservedLockedWords", "skippedLockedWords", "updatedAt",
    ]
    return {key: result.get(key) for key in keep if key in result}


def refresh_known_anki_words_auto() -> dict:
    payload = _merge_refresh_payload_with_saved_settings({
        "fullRebuild": False,
        "autoRun": True,
    })
    if not payload.get("ankiUrl") or not payload.get("decks") or not payload.get("wordFields"):
        result = {
            "ok": False,
            "skipped": True,
            "reason": "Run Refresh Highlight Words once manually to save Anki URL, decks and word fields.",
        }
        settings = _read_anki_highlight_settings()
        _write_anki_highlight_settings({
            **settings,
            "lastAutoRefreshResult": _compact_refresh_result(result),
        })
        return result
    try:
        result = _refresh_known_anki_words_from_anki(payload)
        settings = _read_anki_highlight_settings()
        _write_anki_highlight_settings({
            **settings,
            "lastAutoRefreshError": None,
            "lastAutoRefreshResult": _compact_refresh_result(result),
        })
        return result
    except Exception as err:
        settings = _read_anki_highlight_settings()
        _write_anki_highlight_settings({
            **settings,
            "lastAutoRefreshError": str(err),
            "lastAutoRefreshResult": {"ok": False, "error": str(err)},
        })
        raise


def refresh_known_anki_words_if_stale(context: str = "startup") -> dict:
    settings = _read_anki_highlight_settings()
    checked_at = _utc_now_iso()

    check_at_key = "lastStartupStaleCheckAt" if context == "startup" else "lastPlayerStaleCheckAt"
    check_result_key = "lastStartupStaleCheckResult" if context == "startup" else "lastPlayerStaleCheckResult"

    _write_anki_highlight_settings({**settings, check_at_key: checked_at})

    if not _is_auto_refresh_stale(settings):
        result = {"ok": True, "skipped": True, "reason": "Auto-refresh is not stale."}
        latest_settings = _read_anki_highlight_settings()
        _write_anki_highlight_settings({
            **latest_settings,
            check_result_key: _compact_refresh_result(result),
        })
        return result

    result = refresh_known_anki_words_auto()
    result[f"{context}StaleCheck"] = True

    latest_settings = _read_anki_highlight_settings()
    _write_anki_highlight_settings({
        **latest_settings,
        check_result_key: _compact_refresh_result(result),
    })
    return result


def refresh_known_anki_words_if_stale_on_startup() -> dict:
    return refresh_known_anki_words_if_stale("startup")


@misc_bp.route("/known-anki-words/stale-check", methods=["POST"])
def stale_check_known_anki_words():
    """Run the same daily/weekly stale check when the player opens.

    This covers the common workflow where the server was started before Anki,
    or where startup auto-refresh failed/skipped and the player is opened later.
    It still respects the daily/weekly interval; it is not a forced sync.
    """
    payload = request.get_json(silent=True) or {}
    context = str(payload.get("context") or "player").strip().lower()
    if context not in {"player", "startup"}:
        context = "player"

    try:
        return jsonify(refresh_known_anki_words_if_stale(context))
    except Exception as err:
        return jsonify({"ok": False, "error": str(err)}), 500


def _refresh_single_known_anki_word_from_anki(payload: dict) -> dict:
    anki_url = str(payload.get("ankiUrl") or "").strip()
    if not anki_url:
        saved = _read_anki_highlight_settings()
        anki_url = str(saved.get("ankiUrl") or "").strip()
    if not anki_url:
        raise ValueError("ankiUrl is required")

    raw_note_id = payload.get("noteId")
    try:
        note_id = int(raw_note_id)
    except (TypeError, ValueError):
        note_id = None

    explicit_word = _normalize_highlight_word(payload.get("word"))
    word_fields = [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()]
    if not word_fields:
        saved = _read_anki_highlight_settings()
        word_fields = [str(item).strip() for item in saved.get("wordFields") or [] if str(item).strip()]
    if not word_fields:
        word_fields = ["Word"]

    checked_at = _utc_now_iso()

    note_info = None
    if note_id is not None:
        notes_info = _anki_request(anki_url, "notesInfo", {"notes": [note_id]}) or []
        if notes_info:
            note_info = notes_info[0]

    words: list[str] = []
    if note_info:
        words = extract_words_from_note(note_info, word_fields, _normalize_highlight_word)
    if explicit_word and explicit_word not in words:
        words.append(explicit_word)

    if not words:
        raise ValueError("Could not find a word for this Anki note")

    card_ids = _note_card_ids(note_info or {})
    status = "unknown"
    cards_checked = 0
    if card_ids:
        cards_info = _anki_request(anki_url, "cardsInfo", {"cards": card_ids}) or []
        cards_checked = len(cards_info)
        for card in cards_info:
            status = _pick_better_status(status, _card_status(card))

    data = _read_known_anki_data()
    known_words = data.get("words", {}) if isinstance(data.get("words"), dict) else {}

    updated_words = []
    for word in words:
        old_info = known_words.get(word) if isinstance(known_words.get(word), dict) else {}
        best_status = _pick_better_status(old_info.get("status"), status)
        known_words[word] = {
            **old_info,
            "status": best_status,
            "noteId": note_id,
            "lastCheckedAt": checked_at,
            "locked": best_status == "mature",
        }
        updated_words.append(word)

    saved_settings = _read_anki_highlight_settings()
    data = _write_known_anki_data({
        "updatedAt": checked_at,
        "decks": data.get("decks") or saved_settings.get("decks") or [],
        "wordFields": data.get("wordFields") or word_fields,
        "words": known_words,
    })

    return {
        "ok": True,
        "updatedAt": checked_at,
        "source": str(_known_anki_words_path()),
        "count": len(data.get("words", {})),
        "noteId": note_id,
        "words": updated_words,
        "status": status,
        "cardsChecked": cards_checked,
    }


@misc_bp.route("/known-anki-words/refresh-note", methods=["POST"])
def refresh_known_anki_word_from_note():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid refresh-note payload"}), 400

    try:
        return jsonify(_refresh_single_known_anki_word_from_anki(payload))
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500


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
