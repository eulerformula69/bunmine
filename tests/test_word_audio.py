import asyncio

import pytest

from backend.services import word_audio_service as service
from test_media_export_service import make_settings


def test_word_audio_cleans_text_and_reuses_media(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    calls = []

    async def synthesize(text):
        calls.append(text)
        return b"mp3"

    monkeypatch.setattr(service, "_synthesize", synthesize)
    result = service.create_word_audio(settings, {"text": "<b>猫[ねこ]</b>"})
    assert (settings.audio_dir / result["filename"]).read_bytes() == b"mp3"
    assert service.create_word_audio(settings, {"text": "猫"}) == result
    assert calls == ["猫"]


@pytest.mark.parametrize("text", [None, [], "", "<br>", "a" * 501])
def test_word_audio_rejects_invalid_text(tmp_path, text):
    with pytest.raises(ValueError):
        service.create_word_audio(make_settings(tmp_path), {"text": text})


@pytest.mark.parametrize("chunks, fails", [
    ([{"type": "WordBoundary"}, {"type": "audio", "data": b"mp3"}], False),
    ([], True),
    ([{"type": "audio", "data": b"x" * (service.MAX_AUDIO_BYTES + 1)}], True),
])
def test_synthesis_stream(monkeypatch, chunks, fails):
    class Communicate:
        def __init__(self, text, voice):
            assert (text, voice) == ("猫", "ja-JP-NanamiNeural")

        async def stream(self):
            for chunk in chunks:
                yield chunk

    monkeypatch.setattr(service.edge_tts, "Communicate", Communicate)
    if fails:
        with pytest.raises(RuntimeError):
            asyncio.run(service._synthesize("猫"))
    else:
        assert asyncio.run(service._synthesize("猫")) == b"mp3"


def test_synthesis_error_does_not_save_media(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)

    async def fail(text):
        raise OSError("offline")

    monkeypatch.setattr(service, "_synthesize", fail)
    with pytest.raises(RuntimeError, match="internet"):
        service.create_word_audio(settings, {"text": "猫"})
    assert not list(settings.audio_dir.iterdir())
