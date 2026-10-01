import io
from types import SimpleNamespace

from flask import Flask

from backend.routes.media_routes import media_bp


def make_client(tmp_path):
    video_dir = tmp_path / "videos"
    video_dir.mkdir()
    settings = SimpleNamespace(
        video_dir=video_dir,
        allowed_video_extensions={".mkv"},
        allowed_subtitle_extensions={".srt", ".ass", ".vtt"},
    )
    app = Flask(__name__)
    app.config["SETTINGS"] = settings
    app.register_blueprint(media_bp)
    return app.test_client(), video_dir


def test_ass_upload_and_restore_preserve_original_source(tmp_path):
    client, video_dir = make_client(tmp_path)
    source = (
        "[Events]\n"
        "Dialogue: 0,0:00:56.74,0:00:56.78,OP_CH,,0,0,0,,"
        "{3\\pos(960,12)\\clip(m 964 3.5 b 945.6 3.5)}即使雨过天晴\n"
    )
    stale_srt = video_dir / "episode.srt"
    stale_srt.write_text("stale converted subtitle", encoding="utf-8")

    response = client.post(
        "/upload-subtitle",
        data={
            "videoFilename": "episode.mkv",
            "subtitleFile": (io.BytesIO(source.encode("utf-8")), "source.ass"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.get_json()["filename"] == "episode.ass"
    assert (video_dir / "episode.ass").read_text(encoding="utf-8") == source
    assert not stale_srt.exists()

    restored = client.get("/subtitle/episode.ass")
    assert restored.status_code == 200
    assert restored.get_data(as_text=True) == source


def test_video_rejects_traversal_and_non_video_files(tmp_path):
    client, video_dir = make_client(tmp_path)
    (tmp_path / 'secret.mkv').write_bytes(b'secret')
    (video_dir / 'secret.txt').write_text('secret')
    (video_dir / 'valid.mkv').write_bytes(b'video')
    assert client.get('/video/../secret.mkv').status_code == 400
    assert client.get('/video/..%5Csecret.mkv').status_code == 400
    assert client.get('/video/secret.txt').status_code == 400
    assert client.get('/video/valid.mkv').data == b'video'


def test_video_rejects_resolved_path_outside_root(tmp_path, monkeypatch):
    client, video_dir = make_client(tmp_path)
    (video_dir / 'link.mkv').write_bytes(b'video')
    monkeypatch.setattr('backend.routes.media_routes.is_within', lambda *_: False)
    assert client.get('/video/link.mkv').status_code == 404
