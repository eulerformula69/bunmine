from datetime import UTC, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest

from backend.app import create_app
from backend.http_client import ResponseTooLargeError
from backend.services import anki_highlight_store as store
from backend.services import anki_word_model as model
from backend.services import anki_word_sync_service as sync


def test_manual_refresh_does_not_delay_automatic_refresh():
    old = (datetime.now(UTC) - timedelta(days=2)).isoformat()
    recent = datetime.now(UTC).isoformat()
    assert model._is_auto_refresh_stale({
        "autoRefresh": "daily", "lastAutoRefreshAt": old, "lastManualRefreshAt": recent,
    })
    assert not model._is_auto_refresh_stale({"autoRefresh": "weekly", "lastAutoRefreshAt": old})
    assert not model._is_auto_refresh_stale({"autoRefresh": "off"})


@pytest.mark.parametrize("automatic", [False, True])
def test_refresh_updates_only_its_own_clock(temporary_settings, monkeypatch, automatic):
    store.write_anki_highlight_settings({
        "lastAutoRefreshAt": "2026-01-01T00:00:00Z",
        "lastManualRefreshAt": "2026-01-02T00:00:00Z",
    }, temporary_settings)
    monkeypatch.setattr(sync, "_utc_now_iso", lambda: "2026-01-03T00:00:00Z")
    monkeypatch.setattr(sync, "_anki_request", lambda *_args: [])
    result = sync._refresh_known_anki_words_from_anki({
        "ankiUrl": "http://anki.test", "decks": ["Japanese"], "wordFields": ["Word"], "autoRun": automatic,
    }, temporary_settings)
    saved = store.read_anki_highlight_settings(temporary_settings)
    assert saved["lastAutoRefreshAt"] == ("2026-01-03T00:00:00Z" if automatic else "2026-01-01T00:00:00Z")
    assert saved["lastManualRefreshAt"] == ("2026-01-02T00:00:00Z" if automatic else "2026-01-03T00:00:00Z")
    assert result["count"] == 0


def test_refresh_route_reports_invalid_request_without_private_details(temporary_settings):
    client = create_app(temporary_settings, initialize=False).test_client()
    response = client.post("/known-anki-words/refresh", json={})
    assert response.status_code == 400
    assert response.json["error"]["message"] == "Invalid request"
    assert response.json["error"]["requestId"] == response.headers["X-Request-ID"]


@pytest.mark.parametrize(("card", "expected"), [
    ({"queue": -1}, "suspended"), ({"type": 0}, "new"), ({"type": 1}, "learning"),
    ({"interval": 21}, "mature"), ({"interval": "bad"}, "young"),
])
def test_card_status(card, expected):
    assert model._card_status(card) == expected


@pytest.mark.parametrize("full_rebuild", [False, True])
def test_refresh_preserves_locked_words_or_rebuilds_them(temporary_settings, monkeypatch, full_rebuild):
    store.write_known_anki_data({"words": {"猫": {"status": "mature", "locked": True}}}, temporary_settings)
    calls = []

    def anki(_url, action, params):
        calls.append((action, params))
        if action == "findNotes":
            return [1, 2]
        if action == "notesInfo":
            return [
                {"noteId": 1, "cards": [11], "fields": {"Word": {"value": "猫"}}},
                {"noteId": 2, "cards": [22, 23], "fields": {"Word": {"value": "犬"}}},
            ]
        return [
            {"cardId": 11, "type": 0, "deckName": "Japanese"},
            {"cardId": 22, "type": 1, "deckName": "Z"},
            {"note": 2, "interval": 30, "deckName": "A"},
        ]

    monkeypatch.setattr(sync, "_anki_request", anki)
    result = sync._refresh_known_anki_words_from_anki({
        "ankiUrl": "http://anki.test", "decks": ["Japanese"], "wordFields": ["Word"],
        "fullRebuild": full_rebuild,
    }, temporary_settings)
    words = store.read_known_anki_data(temporary_settings)["words"]
    assert words["猫"]["status"] == ("new" if full_rebuild else "mature")
    assert words["猫"]["cardIds"] == [11]
    assert words["犬"]["status"] == "mature"
    assert words["犬"]["deck"] == "A"
    assert result["count"] == 2
    assert result["cardsChecked"] == (3 if full_rebuild else 2)
    assert calls[-1][1]["cards"] == ([11, 22, 23] if full_rebuild else [22, 23])


def test_card_info_request_splits_large_responses(monkeypatch):
    calls = []

    def anki(_url, action, params):
        assert action == "cardsInfo"
        card_ids = params["cards"]
        calls.append(card_ids)
        if len(card_ids) > 2:
            raise ResponseTooLargeError("Response exceeds the size limit")
        return [{"cardId": card_id} for card_id in card_ids]

    monkeypatch.setattr(sync, "_anki_request", anki)
    result = sync._fetch_cards_info("http://anki.test", [1, 2, 3, 4, 5])

    assert [card["cardId"] for card in result] == [1, 2, 3, 4, 5]
    assert calls == [[1, 2, 3, 4, 5], [1, 2], [3, 4, 5], [3], [4, 5]]


def test_card_info_request_reports_oversized_single_card(monkeypatch):
    def anki(*_args):
        raise ResponseTooLargeError("Response exceeds the size limit")

    monkeypatch.setattr(sync, "_anki_request", anki)
    with pytest.raises(ResponseTooLargeError, match="size limit"):
        sync._fetch_cards_info("http://anki.test", [1])


def test_failed_refresh_does_not_advance_success_clock(temporary_settings, monkeypatch):
    store.write_anki_highlight_settings({"lastAutoRefreshAt": "old"}, temporary_settings)

    def fail(*_args):
        raise OSError("Anki is unavailable")

    monkeypatch.setattr(sync, "_anki_request", fail)
    with pytest.raises(OSError):
        sync._refresh_known_anki_words_from_anki({
            "ankiUrl": "http://anki.test", "decks": ["Japanese"], "wordFields": ["Word"], "autoRun": True,
        }, temporary_settings)
    assert store.read_anki_highlight_settings(temporary_settings)["lastAutoRefreshAt"] == "old"


def test_concurrent_stale_checks_refresh_once_and_keep_both_results(temporary_settings, monkeypatch):
    store.write_anki_highlight_settings({
        "ankiUrl": "http://anki.test", "decks": ["Japanese"], "wordFields": ["Word"],
    }, temporary_settings)
    entered, release, player_started = Event(), Event(), Event()
    calls = []

    def anki(_url, action, _params):
        calls.append(action)
        entered.set()
        assert release.wait(5)
        return []

    def player_check():
        player_started.set()
        return sync.refresh_known_anki_words_if_stale("player", temporary_settings)

    monkeypatch.setattr(sync, "_anki_request", anki)
    with ThreadPoolExecutor(max_workers=2) as pool:
        startup = pool.submit(sync.refresh_known_anki_words_if_stale, "startup", temporary_settings)
        try:
            assert entered.wait(5)
            player = pool.submit(player_check)
            assert player_started.wait(5)
            assert not player.done()
        finally:
            release.set()
        assert startup.result(timeout=5)["ok"]
        assert player.result(timeout=5)["skipped"]
    saved = store.read_anki_highlight_settings(temporary_settings)
    assert calls == ["findNotes"]
    assert saved["lastStartupStaleCheckResult"]["ok"]
    assert saved["lastPlayerStaleCheckResult"]["skipped"]
