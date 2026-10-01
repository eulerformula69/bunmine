import io
from unittest.mock import Mock

import pytest

from backend import http_client


def test_http_response_size_is_bounded(monkeypatch):
    response = io.BytesIO(b"x" * 100)
    monkeypatch.setattr(http_client.urllib.request, "urlopen", Mock(return_value=response))
    with pytest.raises(ValueError, match="size limit"):
        http_client.get_bytes("https://example.com", max_bytes=10)


def test_json_uses_utf8_and_preserves_payload(monkeypatch):
    opener = Mock(return_value=io.BytesIO('{"word":"猫"}'.encode()))
    monkeypatch.setattr(http_client.urllib.request, "urlopen", opener)
    assert http_client.post_json("http://localhost", {"word": "猫"}) == {"word": "猫"}
    assert opener.call_args.args[0].get_method() == "POST"
