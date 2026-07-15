import json

from backend.services import anki_client


def test_build_deck_query_escapes_quotes_and_backslashes():
    assert anki_client.build_deck_query(['Japanese "Mining"', r"Parent\Child"]) == (
        'deck:"Japanese \\"Mining\\"" OR deck:"Parent\\\\Child"'
    )


def test_extract_words_from_note_normalizes_and_deduplicates():
    note = {"fields": {"Word": {"value": " 猫 "}, "Reading": {"value": "猫"}}}
    assert anki_client.extract_words_from_note(note, ["Word", "Reading"], lambda value: str(value).strip()) == ["猫"]


def test_request_uses_anki_connect_protocol(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self):
            return json.dumps({"error": None, "result": [1, 2]}).encode()

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr(anki_client.urllib.request, "urlopen", fake_urlopen)

    assert anki_client.request("http://localhost:8765", "findCards", {"query": "deck:Mining"}) == [1, 2]
    assert captured["timeout"] == 60
    assert json.loads(captured["request"].data) == {
        "action": "findCards",
        "version": 6,
        "params": {"query": "deck:Mining"},
    }
