import io
import json
import urllib.error
from unittest.mock import Mock

import pytest

from backend import library_cover_search as covers


@pytest.mark.parametrize("failure", [
    urllib.error.HTTPError("https://graphql.anilist.co", 403, "Forbidden", {}, None),
    TimeoutError("timeout"),
    ValueError("invalid JSON"),
])
def test_provider_failure_uses_kitsu(monkeypatch, failure):
    monkeypatch.setattr(covers, "search_anilist_covers", Mock(side_effect=failure))
    backup = Mock(return_value=[{"source": "kitsu"}])
    monkeypatch.setattr(covers, "search_kitsu_covers", backup)
    assert covers.search_covers(" Naruto ") == [{"source": "kitsu"}]
    backup.assert_called_once_with("Naruto")


def test_success_does_not_call_backup(monkeypatch):
    monkeypatch.setattr(covers, "search_anilist_covers", Mock(return_value=[{"source": "anilist"}]))
    backup = Mock()
    monkeypatch.setattr(covers, "search_kitsu_covers", backup)
    assert covers.search_covers("Naruto") == [{"source": "anilist"}]
    backup.assert_not_called()


def test_empty_primary_uses_backup(monkeypatch):
    monkeypatch.setattr(covers, "search_anilist_covers", Mock(return_value=[]))
    monkeypatch.setattr(covers, "search_kitsu_covers", Mock(return_value=[{"source": "kitsu"}]))
    assert covers.search_covers("Naruto") == [{"source": "kitsu"}]


def test_both_providers_unavailable(monkeypatch):
    for name in ("search_anilist_covers", "search_kitsu_covers"):
        monkeypatch.setattr(covers, name, Mock(side_effect=TimeoutError()))
    with pytest.raises(RuntimeError, match="temporarily unavailable"):
        covers.search_covers("Naruto")


def test_graphql_errors_are_failures(monkeypatch):
    monkeypatch.setattr(covers, "_http_json_post", Mock(return_value={"data": None, "errors": [{}]}))
    with pytest.raises(ValueError):
        covers.search_anilist_covers("Naruto")


def test_kitsu_maps_covers_and_encodes_query(monkeypatch):
    payload = {"data": [
        {"id": "1", "attributes": {"canonicalTitle": "Title", "posterImage": None}},
        {"id": "2", "attributes": {
            "canonicalTitle": "Title", "titles": {"ja_jp": "Japanese"},
            "posterImage": {"large": "https://media.kitsu.app/cover.jpg"},
            "startDate": "2007-02-15", "episodeCount": 12, "subtype": "TV",
        }},
    ]}
    opener = Mock(return_value=io.BytesIO(json.dumps(payload).encode()))
    monkeypatch.setattr(covers.urllib.request, "urlopen", opener)
    result = covers.search_kitsu_covers("A & B")
    assert len(result) == 1
    assert result[0]["externalId"] == "2"
    assert result[0]["source"] == "kitsu"
    assert result[0]["seasonYear"] == "2007"
    assert "A+%26+B" in opener.call_args.args[0].full_url
