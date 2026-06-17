import json
import os
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from backend.ffmpeg_service import run_subprocess
from backend.library_db import get_library_file_by_id
from backend.services.dedupe_service import get_cached_media, make_dedupe_key, save_cached_media
from backend.services.video_service import resolve_video_path_from_payload
from backend.settings import Settings
from backend.utils_validation import is_within, normalize_text, safe_media_name, to_float


def create_screenshot(settings: Settings, data: dict) -> dict:
    t_val = data.get("time")
    text = data.get("text", "").strip()
    font_size = int(2.0 * int(data.get("fontSize", 40)))
    if t_val is None:
        raise ValueError("time is required")

    video_path_obj, video_identity, error_response = resolve_video_path_from_payload(data, settings)
    if error_response:
        payload, status_code = error_response
        raise MediaExportError(payload.get("error", "Invalid video payload"), status_code)

    raw_screenshot = settings.video_dir / "temp_raw.jpg"
    screenshot_payload = {
        "video": video_identity,
        "time": round(to_float(t_val), 3),
        "text": normalize_text(text),
        "fontSize": font_size,
    }
    screenshot_key = make_dedupe_key("screenshot", screenshot_payload)
    cached_filename = get_cached_media("screenshot", screenshot_key)
    if cached_filename:
        return {"filename": cached_filename, "reused": True}

    cmd = ["ffmpeg", "-y", "-ss", str(t_val), "-i", str(video_path_obj), "-vframes", "1", "-q:v", "2", str(raw_screenshot)]
    run_subprocess(cmd)

    img = Image.open(raw_screenshot)
    draw = ImageDraw.Draw(img)
    font_path = settings.fonts_dir / "NotoSansJP-Bold.ttf"
    try:
        font = ImageFont.truetype(str(font_path), font_size)
    except Exception:
        font = ImageFont.load_default()

    lines = textwrap.wrap(text, width=15)
    line_height = font_size + 15
    y_text = img.height - (len(lines) * line_height) - 60
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        x = (img.width - (bbox[2] - bbox[0])) / 2
        draw.text((x, y_text), line, font=font, fill="white", stroke_width=12, stroke_fill="black")
        y_text += line_height

    screenshot_filename = f"screenshot_{screenshot_key[:24]}.jpg"
    final_path = settings.screenshot_dir / screenshot_filename
    img.save(final_path)
    save_cached_media("screenshot", screenshot_key, screenshot_filename)
    if raw_screenshot.exists():
        raw_screenshot.unlink()
    return {"filename": screenshot_filename, "reused": False}


def create_animated_webp(settings: Settings, data: dict) -> dict:
    start = data.get("start")
    end = data.get("end")
    text = data.get("text", "").strip()
    font_size = int(3.0 * int(data.get("fontSize", 40)))
    if start is None or end is None:
        raise ValueError("start and end are required")

    video_path_obj, video_identity, error_response = resolve_video_path_from_payload(data, settings)
    if error_response:
        payload, status_code = error_response
        raise MediaExportError(payload.get("error", "Invalid video payload"), status_code)

    start_f = round(to_float(start), 3)
    end_f = round(to_float(end), 3)
    if end_f <= start_f:
        end_f = start_f + 0.5
    duration = min(end_f - start_f, 8.0)

    webp_payload = {
        "video": video_identity,
        "start": start_f,
        "duration": round(duration, 3),
        "text": normalize_text(text),
        "fontSize": font_size,
    }
    webp_key = make_dedupe_key("screenshot", webp_payload)
    cached_filename = get_cached_media("screenshot", webp_key)
    if cached_filename:
        return {"filename": cached_filename, "reused": True}

    webp_filename = f"webp_{webp_key[:24]}.webp"
    final_path = settings.screenshot_dir / webp_filename
    ass_path = settings.video_dir / f"temp_{webp_key[:12]}.ass"

    wrapped_text = "\n".join(textwrap.wrap(text, width=15))
    ass_text = (
        wrapped_text
        .replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )
    duration_ass = f"0:00:{duration:05.2f}"
    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans JP,{font_size},&H00FFFFFF,&H00000000,1,12,0,2,40,40,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,{duration_ass},Default,,0,0,0,,{ass_text}
"""
    ass_path.write_text(ass_content, encoding="utf-8")

    ass_filter_path = str(ass_path).replace("\\", "/").replace(":", "\\:")
    fonts_dir_filter = str(settings.fonts_dir).replace("\\", "/").replace(":", "\\:")
    cmd = [
        "ffmpeg", "-y", "-ss", str(start_f), "-t", str(duration), "-i", str(video_path_obj),
        "-vf", f"subtitles='{ass_filter_path}':fontsdir='{fonts_dir_filter}',scale=480:-2:flags=lanczos,fps=10",
        "-c:v", "libwebp", "-lossless", "0", "-quality", "70", "-compression_level", "6", "-preset", "picture",
        "-loop", "0", "-an", str(final_path),
    ]
    try:
        run_subprocess(cmd)
        save_cached_media("screenshot", webp_key, webp_filename)
    finally:
        if ass_path.exists():
            ass_path.unlink()
    return {"filename": webp_filename, "reused": False}


def create_audio_clip(settings: Settings, data: dict) -> dict:
    start = data.get("start")
    end = data.get("end")
    track_index = data.get("trackIndex", "a:0")
    volume_level = data.get("volume", "1")
    if start is None or end is None:
        raise ValueError("start and end are required")

    video_path_obj, video_identity, error_response = resolve_video_path_from_payload(data, settings)
    if error_response:
        payload, status_code = error_response
        raise MediaExportError(payload.get("error", "Invalid video payload"), status_code)

    start_f = round(to_float(start), 3)
    end_f = round(to_float(end), 3)
    volume_f = round(to_float(volume_level, 1.0), 3)
    track_str = str(track_index)
    audio_payload = {
        "video": video_identity,
        "start": start_f,
        "end": end_f,
        "trackIndex": track_str,
        "volume": volume_f,
    }
    audio_key = make_dedupe_key("audio", audio_payload)
    cached_filename = get_cached_media("audio", audio_key)
    if cached_filename:
        return {"filename": cached_filename, "url": f"/get-temp-audio?filename={cached_filename}", "reused": True}

    audio_filename = f"audio_{audio_key[:24]}.mp3"
    audio_path = settings.audio_dir / audio_filename
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path_obj), "-ss", str(start_f), "-to", str(end_f), "-map", f"0:{track_str}",
        "-af", f"volume={volume_f}", "-vn", "-acodec", "libmp3lame", str(audio_path),
    ]
    run_subprocess(cmd)
    save_cached_media("audio", audio_key, audio_filename)
    return {"filename": audio_filename, "url": f"/get-temp-audio?filename={audio_filename}", "reused": False}


def get_audio_tracks(settings: Settings, video_file_id: str | None, filename: str | None) -> dict:
    video_path_obj = _resolve_video_path_from_query(settings, video_file_id, filename)
    cmd = ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index:stream_tags=language,title", "-of", "json", str(video_path_obj)]
    result = run_subprocess(cmd)
    data = json.loads(result.stdout)
    return {"tracks": data.get("streams", [])}


def create_track_url(settings: Settings, data: dict) -> dict:
    track_index = data.get("trackIndex")
    if track_index is None:
        raise ValueError("trackIndex is required")

    video_path_obj, video_identity, error_response = resolve_video_path_from_payload(data, settings)
    if error_response:
        payload, status_code = error_response
        raise MediaExportError(payload.get("error", "Invalid video payload"), status_code)

    track_key = make_dedupe_key("track", {"video": video_identity, "trackIndex": str(track_index)})
    temp_audio_name = f"temp_track_{track_key[:24]}.mka"
    temp_audio_path = settings.video_dir / temp_audio_name
    if not temp_audio_path.exists():
        cmd = ["ffmpeg", "-y", "-i", str(video_path_obj), "-map", f"0:{track_index}", "-c", "copy", str(temp_audio_path)]
        run_subprocess(cmd)
    return {"url": f"/download-audio?name={temp_audio_name}"}


def _resolve_video_path_from_query(settings: Settings, video_file_id: str | None, filename: str | None) -> Path:
    if video_file_id:
        try:
            file_id = int(video_file_id)
        except (TypeError, ValueError) as err:
            raise MediaExportError("Invalid videoFileId", 400) from err
        result = get_library_file_by_id(settings.library_db_path, file_id)
        if not result.get("found"):
            raise MediaExportError("Library video file not found", 404)
        file_info = result["file"]
        if file_info.get("file_type") != "video":
            raise MediaExportError("Library file is not a video", 400)
        video_path_obj = Path(file_info["path"]).resolve()
        if not is_within(settings.media_library_dir, video_path_obj):
            raise MediaExportError("Video file is outside MEDIA_LIBRARY_DIR", 403)
        if not video_path_obj.exists() or not video_path_obj.is_file():
            raise MediaExportError("Video file is missing", 404)
        return video_path_obj

    if not filename:
        raise MediaExportError("filename or videoFileId is required", 400)
    safe_filename = safe_media_name(filename)
    video_path_obj = (settings.video_dir / safe_filename).resolve()
    if not video_path_obj.exists() or not is_within(settings.video_dir, video_path_obj):
        raise MediaExportError(f"File {filename} was not found at {video_path_obj}", 404)
    return video_path_obj


class MediaExportError(RuntimeError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code
