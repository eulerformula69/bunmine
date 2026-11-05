import json
from flask import Blueprint, jsonify, request
from backend.settings import current_settings
from backend.services.anki_highlight_store import serialized_store_update, write_json_atomic

player_settings_bp = Blueprint("player_settings", __name__)

@player_settings_bp.route("/player-settings", methods=["GET", "PATCH"])
@serialized_store_update
def player_settings():
    path = current_settings().data_dir / "player-settings.json"
    if not path.exists():
        write_json_atomic(path, {"language": "en"})
    settings = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        return jsonify(error="Invalid player settings file"), 500
    if request.method == "PATCH":
        patch = request.get_json(silent=True)
        if not isinstance(patch, dict) or any(
            not isinstance(key, str) or len(key) > 100
            or type(value) not in (str, bool, int, float, type(None))
            or isinstance(value, str) and len(value) > 10000
            for key, value in patch.items()
        ):
            return jsonify(error="Invalid player settings"), 400
        settings.update(patch)
        write_json_atomic(path, settings)
    return jsonify(settings=settings)
