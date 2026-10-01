"""Library file routes."""

from pathlib import Path

from backend.api_response import exception_response

from flask import Blueprint, jsonify, request, send_from_directory

from backend.library_scanner import scan_library
from backend.repositories.library_repository import (
    get_library_db_status,
    get_library_file_by_id,
    refresh_library_file_existence,
)
from backend.services.job_service import get_job, start_job
from backend.settings import current_settings
from backend.utils_validation import is_within

library_file_bp = Blueprint("library_file", __name__)


@library_file_bp.post("/library/refresh-files")
def library_refresh_files():
    return jsonify({"ok": True, **refresh_library_file_existence(current_settings().library_db_path)})


def _choose_folder_dialog(initial_dir: Path) -> str | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as err:
        raise RuntimeError(f"Folder dialog is not available: {err}") from err

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        selected = filedialog.askdirectory(initialdir=str(initial_dir), mustexist=True)
    finally:
        root.destroy()
    return selected or None


@library_file_bp.route("/library/config", methods=["GET"])
def library_config():
    settings = current_settings()
    return jsonify({
        "mediaLibraryDir": str(settings.media_library_dir),
        "exists": settings.media_library_dir.exists(),
        "isDirectory": settings.media_library_dir.is_dir(),
        "videoExtensions": sorted(settings.allowed_video_extensions),
        "subtitleExtensions": sorted(settings.allowed_subtitle_extensions),
    })


@library_file_bp.route("/library/db/status", methods=["GET"])
def library_db_status():
    return jsonify(get_library_db_status(current_settings().library_db_path))


@library_file_bp.route("/library/scan", methods=["GET"])
def library_scan():
    settings = current_settings()
    job = start_job(
        "library-scan",
        lambda: scan_library(
            db_path=settings.library_db_path,
            media_root=settings.media_library_dir,
            video_extensions=settings.allowed_video_extensions,
            subtitle_extensions=settings.allowed_subtitle_extensions,
        ),
    )
    return jsonify({"ok": True, "job": job}), 202


@library_file_bp.route("/library/jobs/<job_id>", methods=["GET"])
def library_job_status(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"ok": True, "job": job})


@library_file_bp.route("/library/dialog/folder", methods=["POST"])
def library_choose_folder_dialog():
    data = request.get_json(silent=True) or {}
    raw_initial = str(data.get("initialPath") or "").strip()

    initial_path = current_settings().media_library_dir
    if raw_initial:
        candidate = Path(raw_initial).expanduser().resolve()
        if candidate.exists():
            initial_path = candidate if candidate.is_dir() else candidate.parent

    try:
        selected = _choose_folder_dialog(initial_path)
    except Exception as err:
        return exception_response(err)

    if not selected:
        return jsonify({"cancelled": True, "path": None})

    return jsonify({"cancelled": False, "path": selected})


@library_file_bp.route("/library/scan-path", methods=["POST"])
def library_scan_path():
    settings = current_settings()
    data = request.get_json(silent=True) or {}
    raw_path = str(data.get("path") or "").strip()
    if not raw_path:
        return jsonify({"error": "path is required"}), 400

    target_path = Path(raw_path).expanduser().resolve()
    if not target_path.exists() or not target_path.is_dir():
        return jsonify({"error": "Path must be an existing directory"}), 400
    if not is_within(settings.media_library_dir, target_path):
        return jsonify({"error": "Path must be inside MEDIA_LIBRARY_DIR"}), 403

    job = start_job(
        "library-scan-path",
        lambda: scan_library(
            db_path=settings.library_db_path,
            media_root=target_path,
            video_extensions=settings.allowed_video_extensions,
            subtitle_extensions=settings.allowed_subtitle_extensions,
        ),
    )
    return jsonify({"ok": True, "job": job}), 202


@library_file_bp.route("/library/file/<int:file_id>", methods=["GET"])
def serve_library_file(file_id):
    settings = current_settings()
    result = get_library_file_by_id(settings.library_db_path, file_id)
    if not result.get("found"):
        return jsonify({"error": "File not found"}), 404

    file_path = Path(result["file"]["path"]).resolve()
    if not is_within(settings.media_library_dir, file_path):
        return jsonify({"error": "File is outside MEDIA_LIBRARY_DIR"}), 403
    if not file_path.exists() or not file_path.is_file():
        return jsonify({"error": "File is missing"}), 404
    return send_from_directory(str(file_path.parent), file_path.name, as_attachment=False)
