from datetime import UTC, datetime, timedelta

import pytest

from backend.app import create_app
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
    assert response.json["error"] == "Invalid request"
    assert response.json["errorInfo"]["requestId"] == response.headers["X-Request-ID"]


@pytest.mark.parametrize(("card", "expected"), [
    ({"queue": -1}, "suspended"), ({"type": 0}, "new"), ({"type": 1}, "learning"),
    ({"interval": 21}, "mature"), ({"interval": "bad"}, "young"),
])
def test_card_status(card, expected):
    assert model._card_status(card) == expected
