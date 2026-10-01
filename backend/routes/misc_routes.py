from backend.services.anki_word_sync_service import (
    _refresh_known_anki_words_from_anki,
    _refresh_single_known_anki_word_from_anki,
    refresh_known_anki_words_if_stale,
)
import json

from backend.api_response import exception_response

from flask import Blueprint, jsonify, request

from backend.services.anki_highlight_store import (
    anki_highlight_settings_path as _anki_highlight_settings_path,
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
from backend.settings import current_settings

misc_bp = Blueprint("misc", __name__)


@misc_bp.route("/anki-highlight-cache/<cache_key>", methods=["GET"])
def get_anki_highlight_cache(cache_key):
    try:
        safe_key = safe_cache_key(cache_key)
    except ValueError as err:
        return exception_response(err)

    cache_path = current_settings().anki_highlight_dir / f"{safe_key}.json"
    if not cache_path.exists():
        return jsonify({"found": False})

    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return jsonify({"found": True, "data": data})
    except Exception as err:
        return exception_response(err)


@misc_bp.route("/anki-highlight-cache/<cache_key>", methods=["POST"])
def save_anki_highlight_cache(cache_key):
    try:
        safe_key = safe_cache_key(cache_key)
    except ValueError as err:
        return exception_response(err)

    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid cache payload"}), 400

    cache_path = current_settings().anki_highlight_dir / f"{safe_key}.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return jsonify({"success": True})


@misc_bp.route("/known-basic-words", methods=["GET"])
def get_known_basic_words():
    words_path = _known_basic_words_path()
    if not words_path.exists():
        return jsonify({"words": [], "source": words_path.name, "exists": False})

    try:
        return jsonify({"words": _read_words_file(words_path), "source": words_path.name, "exists": True})
    except ValueError as err:
        return exception_response(err)
    except Exception as err:
        return exception_response(err)


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
        return jsonify(
            {
                "ok": True,
                "word": word,
                "added": word not in before,
                "count": len(normalized_words),
                "source": words_path.name,
            }
        )
    except ValueError as err:
        return exception_response(err)
    except Exception as err:
        return exception_response(err)


@misc_bp.route("/known-anki-words", methods=["GET"])
def get_known_anki_words():
    try:
        data = _read_known_anki_data()
        if not _known_anki_words_path().exists():
            data = _write_known_anki_data(data)
        return jsonify({"found": True, "data": data, "source": _known_anki_words_path().name})
    except ValueError as err:
        return exception_response(err)
    except Exception as err:
        return exception_response(err)


@misc_bp.route("/known-anki-words", methods=["POST"])
def save_known_anki_words():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict) or not isinstance(data.get("words"), dict):
        return jsonify({"error": "Invalid known-anki-words payload"}), 400

    try:
        saved = _write_known_anki_data(data)
        return jsonify({"ok": True, "source": _known_anki_words_path().name, "count": len(saved.get("words", {}))})
    except Exception as err:
        return exception_response(err)


@misc_bp.route("/known-anki-words/auto-refresh-settings", methods=["GET"])
def get_known_anki_auto_refresh_settings():
    try:
        settings = _read_anki_highlight_settings()
        safe_settings = {key: value for key, value in settings.items() if key != "ankiUrl"}
        safe_settings["hasAnkiUrl"] = bool(settings.get("ankiUrl"))
        return jsonify({"ok": True, "settings": safe_settings, "source": _anki_highlight_settings_path().name})
    except Exception as err:
        return exception_response(err)


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
    if "sentenceFields" in payload:
        merged["sentenceFields"] = [
            str(item).strip() for item in payload.get("sentenceFields") or [] if str(item).strip()
        ]
    if "autoRefresh" in payload:
        merged["autoRefresh"] = str(payload.get("autoRefresh") or "off").strip().lower()

    try:
        settings = _write_anki_highlight_settings(merged)
        safe_settings = {key: value for key, value in settings.items() if key != "ankiUrl"}
        safe_settings["hasAnkiUrl"] = bool(settings.get("ankiUrl"))
        return jsonify({"ok": True, "settings": safe_settings, "source": _anki_highlight_settings_path().name})
    except Exception as err:
        return exception_response(err)


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
        return exception_response(err)


@misc_bp.route("/known-anki-words/refresh-note", methods=["POST"])
def refresh_known_anki_word_from_note():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid refresh-note payload"}), 400

    try:
        return jsonify(_refresh_single_known_anki_word_from_anki(payload))
    except ValueError as err:
        return exception_response(err)
    except Exception as err:
        return exception_response(err)


@misc_bp.route("/known-anki-words/refresh", methods=["POST"])
def refresh_known_anki_words():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid refresh payload"}), 400

    payload = _merge_refresh_payload_with_saved_settings(payload)

    try:
        return jsonify(_refresh_known_anki_words_from_anki(payload))
    except ValueError as err:
        return exception_response(err)
    except Exception as err:
        return exception_response(err)
