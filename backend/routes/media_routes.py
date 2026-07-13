import os

from flask import Blueprint, current_app, jsonify, request, send_from_directory

from backend.api_response import legacy_error_response, ok_response
from backend.services.dedupe_service import clean_srt_text_file
from backend.services.media_export_service import (
    MediaExportError,
    create_animated_webp,
    create_audio_clip,
    create_screenshot,
)
from backend.settings import Settings
from backend.utils_validation import is_within, safe_media_name, safe_uploaded_filename

media_bp = Blueprint("media", __name__)


def _settings() -> Settings:
    return current_app.config["SETTINGS"]


def _json_error(err: Exception, status: int = 500, code: str = "MEDIA_ERROR"):
    return legacy_error_response(str(err), status, code)


@media_bp.route("/upload-video", methods=["POST"])
def upload_video():
    settings = _settings()
    file = request.files.get("videoFile")
    if not file:
        return legacy_error_response("File was not received", 400, "MISSING_FILE")
    try:
        filename = safe_uploaded_filename(file.filename, settings.allowed_video_extensions)
    except ValueError as err:
        return _json_error(err, 400, "INVALID_FILENAME")

    save_path = settings.video_dir / filename
    file.save(save_path)
    return ok_response({"filename": filename, "baseName": os.path.splitext(filename)[0]})[0]


@media_bp.route("/upload-subtitle", methods=["POST"])
def upload_subtitle():
    settings = _settings()
    subtitle_file = request.files.get("subtitleFile")
    video_filename = request.form.get("videoFilename")

    if not subtitle_file:
        return legacy_error_response("Subtitle file is not received", 400, "MISSING_SUBTITLE")
    if not video_filename:
        return legacy_error_response("Video filename is required", 400, "MISSING_VIDEO_FILENAME")

    try:
        safe_video_filename = safe_uploaded_filename(video_filename, settings.allowed_video_extensions)
    except ValueError as err:
        return _json_error(err, 400, "INVALID_VIDEO_FILENAME")

    subtitle_ext = os.path.splitext(subtitle_file.filename or "")[1].lower()
    if subtitle_ext not in settings.allowed_subtitle_extensions:
        return legacy_error_response("Unsupported subtitle format", 400, "INVALID_SUBTITLE_EXTENSION")

    video_base_name = os.path.splitext(safe_video_filename)[0]
    subtitle_filename = f"{video_base_name}{subtitle_ext}"
    subtitle_path = settings.video_dir / subtitle_filename
    subtitle_file.save(subtitle_path)
    if subtitle_ext == ".srt":
        clean_srt_text_file(subtitle_path)
    for extension in settings.allowed_subtitle_extensions:
        stale_path = settings.video_dir / f"{video_base_name}{extension}"
        if stale_path != subtitle_path and stale_path.exists():
            stale_path.unlink()
    return ok_response({"filename": subtitle_filename})[0]


@media_bp.route("/current-video", methods=["GET"])
def current_video():
    settings = _settings()
    videos = [
        path for path in settings.video_dir.iterdir()
        if path.is_file() and path.suffix.lower() in settings.allowed_video_extensions
    ]
    if not videos:
        return jsonify({"ok": True, "filename": None, "subtitleFilename": None})

    latest_video = max(videos, key=lambda path: path.stat().st_mtime)
    subtitle_filename = None
    for extension in settings.allowed_subtitle_extensions:
        candidate = settings.video_dir / f"{latest_video.stem}{extension}"
        if candidate.exists():
            subtitle_filename = candidate.name
            break
    return jsonify({"ok": True, "filename": latest_video.name, "subtitleFilename": subtitle_filename})


@media_bp.route("/videos", methods=["GET"])
def list_videos():
    settings = _settings()
    videos = []
    for path in settings.video_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in settings.allowed_video_extensions:
            continue
        subtitle_candidate = next(
            (settings.video_dir / f"{path.stem}{extension}" for extension in settings.allowed_subtitle_extensions
             if (settings.video_dir / f"{path.stem}{extension}").exists()),
            None,
        )
        videos.append({
            "filename": path.name,
            "subtitleFilename": subtitle_candidate.name if subtitle_candidate else None,
            "modifiedTime": path.stat().st_mtime,
        })
    videos.sort(key=lambda item: item["modifiedTime"], reverse=True)
    return jsonify({"ok": True, "videos": videos})


@media_bp.route("/video/<path:filename>")
def serve_video(filename):
    return send_from_directory(str(_settings().video_dir), filename)


@media_bp.route("/subtitle/<path:filename>")
def serve_subtitle(filename):
    settings = _settings()
    safe_name = os.path.basename(filename)
    subtitle_path = settings.video_dir / safe_name
    if not subtitle_path.exists():
        return legacy_error_response("Subtitle not found", 404, "SUBTITLE_NOT_FOUND")
    if os.path.splitext(safe_name)[1].lower() not in settings.allowed_subtitle_extensions:
        return legacy_error_response("Invalid subtitle extension", 400, "INVALID_SUBTITLE_EXTENSION")
    return send_from_directory(str(subtitle_path.parent), subtitle_path.name)


@media_bp.route("/screenshot", methods=["POST"])
def screenshot():
    try:
        return ok_response(create_screenshot(_settings(), request.get_json(silent=True) or {}))[0]
    except MediaExportError as err:
        return _json_error(err, err.status_code, "MEDIA_EXPORT_FAILED")
    except ValueError as err:
        return _json_error(err, 400, "INVALID_REQUEST")
    except RuntimeError as err:
        return _json_error(err, 500, "FFMPEG_SCREENSHOT_FAILED")


@media_bp.route("/animated-webp", methods=["POST"])
def animated_webp():
    try:
        return ok_response(create_animated_webp(_settings(), request.get_json(silent=True) or {}))[0]
    except MediaExportError as err:
        return _json_error(err, err.status_code, "MEDIA_EXPORT_FAILED")
    except ValueError as err:
        return _json_error(err, 400, "INVALID_REQUEST")
    except RuntimeError as err:
        return _json_error(err, 500, "FFMPEG_WEBP_FAILED")


@media_bp.route("/audio-to-anki", methods=["POST"])
def audio():
    try:
        return ok_response(create_audio_clip(_settings(), request.get_json(silent=True) or {}))[0]
    except MediaExportError as err:
        return _json_error(err, err.status_code, "MEDIA_EXPORT_FAILED")
    except ValueError as err:
        return _json_error(err, 400, "INVALID_REQUEST")
    except RuntimeError as err:
        return _json_error(err, 500, "FFMPEG_AUDIO_FAILED")


@media_bp.route("/get-temp-audio")
def get_temp_audio():
    settings = _settings()
    filename = request.args.get("filename")
    try:
        safe_name = safe_media_name(filename)
    except ValueError as err:
        return _json_error(err, 400, "INVALID_FILENAME")
    file_path = settings.audio_dir / safe_name
    if not file_path.exists() or not is_within(settings.audio_dir, file_path):
        return legacy_error_response("File not found", 404, "AUDIO_NOT_FOUND")
    return send_from_directory(str(settings.audio_dir), safe_name, mimetype="audio/mpeg")


@media_bp.route("/delete-video", methods=["DELETE"])
def delete_video():
    settings = _settings()
    filename = request.args.get("filename")
    if not filename:
        return legacy_error_response("filename is required", 400, "MISSING_FILENAME")
    try:
        safe_filename = safe_media_name(filename)
    except ValueError as err:
        return _json_error(err, 400, "INVALID_FILENAME")

    video_path = settings.video_dir / safe_filename
    if video_path.exists():
        video_path.unlink()
    video_base_name = os.path.splitext(safe_filename)[0]
    for extension in settings.allowed_subtitle_extensions:
        subtitle_path = settings.video_dir / f"{video_base_name}{extension}"
        if subtitle_path.exists():
            subtitle_path.unlink()

    for item in os.listdir(settings.video_dir):
        if item.startswith("temp_") and safe_filename in item:
            try:
                (settings.video_dir / item).unlink()
            except Exception:
                pass
    return ok_response({"success": True})[0]
