import hashlib
from pathlib import Path

from backend.ffmpeg_service import run_subprocess


def convert_ass_to_srt(source_path: Path, target_path: Path) -> Path:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = target_path.with_name(f"{target_path.stem}.tmp.srt")
    try:
        run_subprocess([
            "ffmpeg", "-y", "-i", str(source_path),
            "-c:s", "srt", str(temporary_path),
        ])
        temporary_path.replace(target_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()
    return target_path


def get_srt_playback_subtitle(source_path: Path, cache_dir: Path) -> Path:
    if source_path.suffix.lower() != ".ass":
        return source_path

    stat = source_path.stat()
    identity = f"{source_path.resolve()}|{stat.st_mtime_ns}|{stat.st_size}"
    cache_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
    target_path = cache_dir / f"subtitle_{cache_key}.srt"
    if not target_path.exists():
        convert_ass_to_srt(source_path, target_path)
    return target_path
