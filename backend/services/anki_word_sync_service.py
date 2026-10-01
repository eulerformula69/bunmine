from backend.settings import Settings
from backend.services.anki_client import (
    build_deck_query as _build_deck_query,
    chunked as _chunked,
    extract_words_from_note,
    note_card_ids as _note_card_ids,
    request as _anki_request,
)
from backend.services.anki_highlight_store import (
    enrich_cached_word_metadata as _enrich_cached_word_metadata,
    known_anki_words_path as _known_anki_words_path,
    merge_refresh_payload_with_saved_settings as _merge_refresh_payload_with_saved_settings,
    read_anki_highlight_settings as _read_anki_highlight_settings,
    read_known_anki_data as _read_known_anki_data,
    write_anki_highlight_settings as _write_anki_highlight_settings,
    write_known_anki_data as _write_known_anki_data,
)
from backend.services.anki_word_model import (
    _card_status,
    _is_auto_refresh_stale,
    _normalize_highlight_word,
    _pick_better_status,
    _utc_now_iso,
)

def _refresh_known_anki_words_from_anki(payload: dict, settings: Settings | None = None) -> dict:
    anki_url = str(payload.get("ankiUrl") or "").strip()
    deck_names = [str(item).strip() for item in payload.get("decks") or [] if str(item).strip()]
    word_fields = [str(item).strip() for item in payload.get("wordFields") or [] if str(item).strip()]
    sentence_fields = [str(item).strip() for item in payload.get("sentenceFields") or [] if str(item).strip()]
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
    saved_settings = _read_anki_highlight_settings(settings)
    _write_anki_highlight_settings({
        **saved_settings,
        "ankiUrl": anki_url,
        "decks": deck_names,
        "wordFields": word_fields,
        "sentenceFields": sentence_fields,
        "autoRefresh": auto_refresh,
        "lastManualRefreshAt": checked_at if not payload.get("autoRun") else saved_settings.get("lastManualRefreshAt"),
        "lastAutoRefreshAt": checked_at if payload.get("autoRun") else saved_settings.get("lastAutoRefreshAt"),
        "lastAutoRefreshError": None,
    }, settings)

    previous = _read_known_anki_data(settings)
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
    note_fields: dict[str, dict] = {}
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
            note_fields[note_id] = note.get("fields") if isinstance(note.get("fields"), dict) else {}
            discovered_words += len(words)

            needs_status_check = full_rebuild
            if not needs_status_check:
                for word in words:
                    old_info = previous_words.get(word) if isinstance(previous_words.get(word), dict) else {}
                    if old_info.get("locked") is True and old_info.get("status") == "mature":
                        next_words[word] = _enrich_cached_word_metadata(old_info, card_ids, note_fields[note_id])
                        preserved_locked_words += 1
                    else:
                        needs_status_check = True

            if not needs_status_check:
                continue

            for card_id in card_ids:
                card_to_note[card_id] = note_id
                candidate_card_ids.append(card_id)

    note_status_map: dict[str, str] = {}
    note_deck_map: dict[str, str] = {}
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
            deck_name = str(card.get("deckName") or "").strip()
            if deck_name and (note_id not in note_deck_map or deck_name < note_deck_map[note_id]):
                note_deck_map[note_id] = deck_name

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
                next_words[word] = _enrich_cached_word_metadata(
                    old_info,
                    note_cards.get(note_id, []),
                    note_fields.get(note_id, {}),
                )
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
                "cardIds": note_cards.get(note_id, []),
                "deck": note_deck_map.get(note_id, ""),
                "fields": note_fields.get(note_id, {}),
                "lastCheckedAt": checked_at,
                "locked": best_status == "mature",
            }
            imported_words += 1

    result_data = _write_known_anki_data({
        "updatedAt": checked_at,
        "decks": deck_names,
        "wordFields": word_fields,
        "sentenceFields": sentence_fields,
        "words": next_words,
    }, settings)

    return {
        "ok": True,
        "updatedAt": checked_at,
        "source": _known_anki_words_path(settings).name,
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


def refresh_known_anki_words_auto(settings: Settings | None = None) -> dict:
    payload = _merge_refresh_payload_with_saved_settings({
        "fullRebuild": False,
        "autoRun": True,
    }, settings)
    if not payload.get("ankiUrl") or not payload.get("decks") or not payload.get("wordFields"):
        result = {
            "ok": False,
            "skipped": True,
            "reason": "Run Refresh Highlight Words once manually to save Anki URL, decks and word fields.",
        }
        saved_settings = _read_anki_highlight_settings(settings)
        _write_anki_highlight_settings({
            **saved_settings,
            "lastAutoRefreshResult": _compact_refresh_result(result),
        }, settings)
        return result
    try:
        result = _refresh_known_anki_words_from_anki(payload, settings)
        saved_settings = _read_anki_highlight_settings(settings)
        _write_anki_highlight_settings({
            **saved_settings,
            "lastAutoRefreshError": None,
            "lastAutoRefreshResult": _compact_refresh_result(result),
        }, settings)
        return result
    except Exception as err:
        saved_settings = _read_anki_highlight_settings(settings)
        _write_anki_highlight_settings({
            **saved_settings,
            "lastAutoRefreshError": str(err),
            "lastAutoRefreshResult": {"ok": False, "error": str(err)},
        }, settings)
        raise


def refresh_known_anki_words_if_stale(context: str = "startup", settings: Settings | None = None) -> dict:
    saved_settings = _read_anki_highlight_settings(settings)
    checked_at = _utc_now_iso()

    check_at_key = "lastStartupStaleCheckAt" if context == "startup" else "lastPlayerStaleCheckAt"
    check_result_key = "lastStartupStaleCheckResult" if context == "startup" else "lastPlayerStaleCheckResult"

    _write_anki_highlight_settings({**saved_settings, check_at_key: checked_at}, settings)

    if not _is_auto_refresh_stale(saved_settings):
        result = {"ok": True, "skipped": True, "reason": "Auto-refresh is not stale."}
        latest_settings = _read_anki_highlight_settings(settings)
        _write_anki_highlight_settings({
            **latest_settings,
            check_result_key: _compact_refresh_result(result),
        }, settings)
        return result

    result = refresh_known_anki_words_auto(settings)
    result[f"{context}StaleCheck"] = True

    latest_settings = _read_anki_highlight_settings(settings)
    _write_anki_highlight_settings({
        **latest_settings,
        check_result_key: _compact_refresh_result(result),
    }, settings)
    return result


def refresh_known_anki_words_if_stale_on_startup(settings: Settings) -> dict:
    return refresh_known_anki_words_if_stale("startup", settings)


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
        "source": _known_anki_words_path().name,
        "count": len(data.get("words", {})),
        "noteId": note_id,
        "words": updated_words,
        "status": status,
        "cardsChecked": cards_checked,
    }

