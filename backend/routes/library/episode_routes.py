"""Library episode routes."""

from backend.api_response import exception_response

from flask import Blueprint, jsonify, request

from backend.repositories.playback_repository import (
    get_episode_playback,
    save_episode_progress,
    set_episode_completed,
)
from backend.library_deletion import delete_missing_library_episode
from backend.utils_validation import to_float
from backend.settings import current_settings
from backend.repositories.episode_repository import set_episode_ignored

library_episode_bp = Blueprint("library_episode", __name__)


@library_episode_bp.route("/library/episodes/<int:episode_id>/ignored", methods=["POST"])
def library_episode_ignored(episode_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or type(data.get("ignored")) is not bool:
        return jsonify({"error": "ignored must be a boolean"}), 400
    try:
        found = set_episode_ignored(current_settings().library_db_path, episode_id, data["ignored"])
    except Exception as err:
        return exception_response(err)
    if not found:
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, "episodeId": episode_id, "isIgnored": data["ignored"]})


@library_episode_bp.route("/library/episodes/<int:episode_id>/playback", methods=["GET"])
def library_episode_playback(episode_id):
    result = get_episode_playback(current_settings().library_db_path, episode_id)
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    if result.get("error"):
        return jsonify({"error": result["error"]}), 404
    return jsonify(result["playback"])


@library_episode_bp.route("/library/episodes/<int:episode_id>", methods=["DELETE"])
def library_episode_delete(episode_id):
    try:
        result = delete_missing_library_episode(current_settings().library_db_path, episode_id)
    except Exception as err:
        return exception_response(err)

    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    if not result.get("deleted"):
        return jsonify({"error": "Episode still has existing media files"}), 409
    return jsonify({"ok": True, **result})


@library_episode_bp.route("/library/episodes/<int:episode_id>/progress", methods=["POST"])
def library_episode_progress(episode_id):
    data = request.get_json(silent=True) or {}
    current_time_seconds = to_float(data.get("currentTimeSeconds"), 0)
    watched_delta_seconds = to_float(data.get("watchedDeltaSeconds"), 0)
    raw_duration = data.get("durationSeconds")
    duration_seconds = None if raw_duration is None else to_float(raw_duration, 0)
    completed = bool(data.get("completed", False))

    result = save_episode_progress(
        db_path=current_settings().library_db_path,
        episode_id=episode_id,
        current_time_seconds=current_time_seconds,
        duration_seconds=duration_seconds,
        watched_delta_seconds=watched_delta_seconds,
        completed=completed,
    )
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, "progress": result["progress"]})


@library_episode_bp.route("/library/episodes/<int:episode_id>/completed", methods=["POST"])
def library_episode_completed(episode_id):
    data = request.get_json(silent=True) or {}
    completed = bool(data.get("completed", False))
    result = set_episode_completed(
        db_path=current_settings().library_db_path,
        episode_id=episode_id,
        completed=completed,
    )
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, "progress": result["progress"]})
