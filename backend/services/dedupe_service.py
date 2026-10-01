import hashlib
import json
import logging
from pathlib import Path
from typing import Optional

from backend.app_state import dedupe_lock
from backend.settings import Settings
from backend.text_processing import strip_html


def load_dedupe_index(settings: Settings) -> dict:
    if not settings.dedupe_index_path.exists():
        return {"screenshot": {}, "audio": {}}
    try:
        data = json.loads(settings.dedupe_index_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"screenshot": {}, "audio": {}}
        data.setdefault("screenshot", {})
        data.setdefault("audio", {})
        return data
    except Exception:
        logging.getLogger(__name__).exception("Could not read media cache index")
        return {"screenshot": {}, "audio": {}}


def save_dedupe_index(settings: Settings, index_data: dict) -> None:
    settings.dedupe_index_path.write_text(
        json.dumps(index_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def make_dedupe_key(kind: str, payload: dict) -> str:
    canonical = json.dumps(
        {"kind": kind, "payload": payload},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def get_cached_media(settings: Settings, kind: str, dedupe_key: str) -> Optional[str]:
    with dedupe_lock:
        index_data = load_dedupe_index(settings)
        filename = index_data.get(kind, {}).get(dedupe_key)
    if not filename:
        return None

    base_dir = settings.screenshot_dir if kind == "screenshot" else settings.audio_dir
    file_path = base_dir / filename
    if file_path.exists() and file_path.stat().st_size > 0:
        return filename
    return None


def save_cached_media(settings: Settings, kind: str, dedupe_key: str, filename: str) -> None:
    with dedupe_lock:
        index_data = load_dedupe_index(settings)
        index_data.setdefault(kind, {})
        index_data[kind][dedupe_key] = filename
        save_dedupe_index(settings, index_data)


def clean_srt_text_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    text = strip_html(text, preserve_newlines=True)
    path.write_text(text, encoding="utf-8")




