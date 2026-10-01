import pytest

from backend.library_covers import download_cover_file
from backend import library_covers as covers


def test_download_cover_rejects_file_url(tmp_path):
    with pytest.raises(ValueError, match="HTTPS"):
        download_cover_file(
            tmp_path,
            series_id=1,
            source="test",
            external_id="1",
            cover_url="file:///etc/passwd",
            allowed_hosts=frozenset({"s3.anilist.co"}),
            max_bytes=1024,
        )


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1"])
def test_cover_rejects_private_dns(monkeypatch, address):
    monkeypatch.setattr(covers.socket, "getaddrinfo", lambda *_args, **_kwargs: [(0, 0, 0, "", (address, 443))])
    with pytest.raises(ValueError, match="non-public"):
        covers._validate_cover_url("https://s3.anilist.co/cover.jpg", frozenset({"s3.anilist.co"}))


def test_cover_download_uses_size_limit_and_safe_name(tmp_path, monkeypatch):
    monkeypatch.setattr(covers.socket, "getaddrinfo", lambda *_args, **_kwargs: [(0, 0, 0, "", ("8.8.8.8", 443))])
    calls = []
    monkeypatch.setattr(covers, "get_bytes", lambda url, **options: calls.append((url, options)) or b"image")
    path = download_cover_file(tmp_path, 3, "../anilist", "../../7", "https://s3.anilist.co/a.png", frozenset({"s3.anilist.co"}), 12)
    assert path.parent == tmp_path
    assert path.read_bytes() == b"image"
    assert calls[0][1]["max_bytes"] == 12
    assert calls[0][1]["content_type"] == "image/"


def test_cover_redirect_revalidates_target():
    handler = covers._ValidatedRedirectHandler(frozenset({"s3.anilist.co"}))
    with pytest.raises(ValueError, match="allowed host"):
        handler.redirect_request(None, None, 302, "redirect", {}, "https://localhost/private")
