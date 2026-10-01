"""Library series routes."""

from backend.api_response import exception_response

from flask import Blueprint, jsonify, request

from backend.repositories.library_repository import (
    get_library_series_debug,
    get_library_series_detail,
    get_library_series_files_debug,
    get_library_series_list,
)
from backend.library_deletion import delete_library_series
from backend.services.library_service import relink_library_series_files
from backend.settings import current_settings

library_series_bp = Blueprint("library_series", __name__)


@library_series_bp.route("/library/debug/series", methods=["GET"])
def library_debug_series():
    return jsonify({"series": get_library_series_debug(current_settings().library_db_path)})


@library_series_bp.route("/library/debug/series/<int:series_id>/files", methods=["GET"])
def library_debug_series_files(series_id):
    result = get_library_series_files_debug(current_settings().library_db_path, series_id)
    status_code = 200 if result.get("found") else 404
    return jsonify(result), status_code


@library_series_bp.route("/library/series", methods=["GET"])
def library_series_list():
    return jsonify({"series": get_library_series_list(current_settings().library_db_path)})


@library_series_bp.route("/library/series/<int:series_id>", methods=["GET"])
def library_series_detail(series_id):
    result = get_library_series_detail(current_settings().library_db_path, series_id)
    status_code = 200 if result.get("found") else 404
    return jsonify(result), status_code


@library_series_bp.route("/library/series/<int:series_id>", methods=["DELETE"])
def library_series_delete(series_id):
    try:
        result = delete_library_series(current_settings().library_db_path, series_id)
    except Exception as err:
        return exception_response(err)

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_series_bp.route("/library/series/<int:series_id>/relink", methods=["POST"])
def library_series_relink(series_id):
    data = request.get_json(silent=True) or {}
    raw_path = str(data.get("path") or "").strip()
    if not raw_path:
        return jsonify({"error": "path is required"}), 400

    from pathlib import Path
    target_path = Path(raw_path).expanduser().resolve()
    if not target_path.exists():
        return jsonify({"error": "Path does not exist"}), 400

    try:
        result = relink_library_series_files(
            db_path=current_settings().library_db_path,
            series_id=series_id,
            new_base=target_path,
            media_root=current_settings().media_library_dir,
        )
    except Exception as err:
        return exception_response(err)

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})
