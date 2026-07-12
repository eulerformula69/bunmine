import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

from backend.ffmpeg_service import run_subprocess
from backend.services.dedupe_service import get_cached_media, make_dedupe_key, save_cached_media
from backend.services.video_service import resolve_video_path_from_payload
from backend.settings import Settings
from backend.utils_validation import normalize_text, to_float


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
    track_index = data.get("trackIndex", "default")
    volume_level = data.get("volume", "1")

    if start is None or end is None:
        raise ValueError("start and end are required")

    video_path_obj, video_identity, error_response = resolve_video_path_from_payload(
        data,
        settings,
    )
    if error_response:
        payload, status_code = error_response
        raise MediaExportError(
            payload.get("error", "Invalid video payload"),
            status_code,
        )

    start_f = round(to_float(start), 3)
    end_f = round(to_float(end), 3)
    duration_f = round(end_f - start_f, 3)

    volume_f = round(to_float(volume_level, 1.0), 3)
    track_str = str(track_index or "default")

    if start_f < 0:
        raise ValueError(f"Invalid audio start time: {start_f}")

    if duration_f <= 0:
        raise ValueError(
            f"Invalid audio interval: start={start_f}, end={end_f}"
        )

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
        return {
            "filename": cached_filename,
            "url": f"/get-temp-audio?filename={cached_filename}",
            "reused": True,
        }

    audio_filename = f"audio_{audio_key[:24]}.mp3"
    audio_path = settings.audio_dir / audio_filename

    cmd = [
        "ffmpeg",
        "-y",

        # Переходим к началу предложения до декодирования файла.
        "-ss",
        str(start_f),

        "-i",
        str(video_path_obj),

        # Вырезаем длительность предложения.
        "-t",
        str(duration_f),
    ]

    if track_str != "default":
        cmd.extend([
            "-map",
            f"0:{track_str}",
        ])
    else:
        cmd.extend([
            "-map",
            "0:a:0",
        ])

    cmd.extend([
        "-vn",
        "-af",
        f"volume={volume_f}",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        str(audio_path),
    ])

    run_subprocess(cmd)

    save_cached_media("audio", audio_key, audio_filename)

    return {
        "filename": audio_filename,
        "url": f"/get-temp-audio?filename={audio_filename}",
        "reused": False,
    }

class MediaExportError(RuntimeError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code
