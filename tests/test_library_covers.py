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


def test_cover_download_rejects_oversize_response(tmp_path, monkeypatch):
    import io
    class Response(io.BytesIO):
        headers = {'Content-Type': 'image/png'}
        def read(self, size=-1):
            assert size == 11
            return super().read(size)
    monkeypatch.setattr(covers.socket, 'getaddrinfo', lambda *a, **k: [(2, 1, 6, '', ('8.8.8.8', 443))])
    monkeypatch.setattr(covers.urllib.request.OpenerDirector, 'open', lambda *a, **k: Response(b'x' * 20))
    with pytest.raises(ValueError, match='size limit'):
        download_cover_file(tmp_path, 1, 'test', 1, 'https://s3.anilist.co/a.png', frozenset({'s3.anilist.co'}), 10)
    assert list(tmp_path.iterdir()) == []


def test_https_connection_uses_validated_address_and_original_tls_host(monkeypatch):
    from unittest.mock import Mock
    from urllib.request import Request
    resolver = Mock(return_value=[(2, 1, 6, '', ('8.8.8.8', 443))])
    monkeypatch.setattr(covers.socket, 'getaddrinfo', resolver)
    sock = Mock()
    monkeypatch.setattr(covers.socket, 'socket', Mock(return_value=sock))
    handler = covers._PinnedHTTPSHandler(frozenset({'s3.anilist.co'}))
    def open_connection(factory, request):
        conn = factory(request.host, timeout=12)
        assert conn.host == 's3.anilist.co'
        resolver.side_effect = AssertionError('Must not resolve again')
        assert conn._create_connection((conn.host, 443), 12) is sock
        sock.connect.assert_called_once_with(('8.8.8.8', 443))
    monkeypatch.setattr(handler, 'do_open', open_connection)
    handler.https_open(Request('https://s3.anilist.co/a.png'))
    resolver.assert_called_once()
