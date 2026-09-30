"""Library cover routes."""

from flask import Blueprint, jsonify, request, send_from_directory

from backend.library_covers import get_series_cover_file, resolve_cover_file_path, save_series_cover
from backend.library_cover_search import search_covers
from backend.repositories.library_repository import get_library_series_detail
from backend.settings import current_settings

library_cover_bp = Blueprint("library_cover", __name__)


@library_cover_bp.route("/library/series/<int:series_id>/cover/search", methods=["GET"])
def library_series_cover_search(series_id):
    detail = get_library_series_detail(current_settings().library_db_path, series_id)
    if not detail.get("found"):
        return jsonify({"error": "Series not found"}), 404

    query = request.args.get("q") or detail["series"]["title"]
    try:
        results = search_covers(query)
    except Exception as err:
        return jsonify({"error": str(err)}), 502

    return jsonify({"seriesId": series_id, "query": query, "results": results})


@library_cover_bp.route("/library/series/<int:series_id>/cover/select", methods=["POST"])
def library_series_cover_select(series_id):
    data = request.get_json(silent=True) or {}
    source = data.get("source")
    external_id = data.get("externalId")
    cover_url = data.get("coverUrl")

    if source not in {"anilist", "kitsu"}:
        return jsonify({"error": "Unsupported cover source"}), 400
    if not external_id or not cover_url:
        return jsonify({"error": "externalId and coverUrl are required"}), 400

    try:
        result = save_series_cover(
            db_path=current_settings().library_db_path,
            covers_dir=current_settings().library_covers_dir,
            series_id=series_id,
            source=source,
            external_id=external_id,
            cover_url=cover_url,
        )
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, "coverFileId": result["coverFileId"], "coverUrl": f"/library/cover/{series_id}"})


@library_cover_bp.route("/library/cover/<int:series_id>", methods=["GET"])
def library_series_cover(series_id):
    result = get_series_cover_file(current_settings().library_db_path, series_id)
    if not result.get("found"):
        return jsonify({"error": "Cover not found"}), 404

    cover_path = resolve_cover_file_path(current_settings().library_covers_dir, result["file"])
    if not cover_path:
        return jsonify({"error": "Cover file is missing"}), 404

    return send_from_directory(str(cover_path.parent), cover_path.name, as_attachment=False)
