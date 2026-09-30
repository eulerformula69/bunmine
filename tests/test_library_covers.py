import pytest

from backend.library_covers import download_cover_file


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
