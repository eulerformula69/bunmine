import asyncio
import re

import edge_tts

from backend.services.dedupe_service import get_cached_media, make_dedupe_key, save_cached_media
from backend.settings import Settings
from backend.text_processing import strip_html

VOICE = "ja-JP-NanamiNeural"
MAX_AUDIO_BYTES = 10 * 1024 * 1024


async def _synthesize(text: str) -> bytes:
    audio = bytearray()
    async with asyncio.timeout(60):
        async for chunk in edge_tts.Communicate(text, VOICE).stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
                if len(audio) > MAX_AUDIO_BYTES:
                    raise RuntimeError("Word audio exceeds 10 MB")
    if not audio:
        raise RuntimeError("The speech service returned no audio. Try again.")
    return bytes(audio)


def create_word_audio(settings: Settings, data: dict) -> dict:
    value = data.get("text")
    if not isinstance(value, str) or len(value) > 500:
        raise ValueError("Word text must be a string of at most 500 characters")
    text = re.sub(r"\[[^\]]*\]", "", strip_html(value)).strip()
    if not text:
        raise ValueError("Word text is required")
    key = make_dedupe_key("audio", {"word": text, "voice": VOICE})
    cached = get_cached_media(settings, "audio", key)
    if cached:
        return {"filename": cached}
    try:
        audio = asyncio.run(_synthesize(text))
    except Exception as exc:
        raise RuntimeError("Could not create word audio. Check your internet connection and try again.") from exc
    filename = f"word_nanami_{key[:24]}.mp3"
    (settings.audio_dir / filename).write_bytes(audio)
    save_cached_media(settings, "audio", key, filename)
    return {"filename": filename}
