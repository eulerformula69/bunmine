"""Library episode routes."""

from flask import Blueprint, jsonify, request

from backend.config import LIBRARY_DB_PATH
from backend.repositories.playback_repository import (
    get_episode_playback,
    save_episode_progress,
    set_episode_completed,
)
from backend.library_deletion import delete_missing_library_episode
from backend.utils_validation import to_float

library_episode_bp = Blueprint("library_episode", __name__)


@library_episode_bp.route("/library/episodes/<int:episode_id>/playback", methods=["GET"])
def library_episode_playback(episode_id):
    result = get_episode_playback(LIBRARY_DB_PATH, episode_id)
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    if result.get("error"):
        return jsonify({"error": result["error"]}), 404
    return jsonify(result["playback"])


@library_episode_bp.route("/library/episodes/<int:episode_id>", methods=["DELETE"])
def library_episode_delete(episode_id):
    try:
        result = delete_missing_library_episode(LIBRARY_DB_PATH, episode_id)
    except Exception as err:
        return jsonify({"error": str(err)}), 500

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
        db_path=LIBRARY_DB_PATH,
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
        db_path=LIBRARY_DB_PATH,
        episode_id=episode_id,
        completed=completed,
    )
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, "progress": result["progress"]})
