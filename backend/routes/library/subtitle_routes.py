"""Library subtitle routes."""

import urllib.error

from flask import Blueprint, jsonify, request

from backend.library_subtitles import (
    build_episode_jimaku_subtitle_plan,
    build_missing_jimaku_subtitle_plan,
    build_series_jimaku_subtitle_analysis,
    bulk_download_missing_jimaku_subtitles,
    get_missing_jimaku_subtitle_candidates,
    download_and_save_jimaku_subtitle,
    get_episode_subtitle_context,
    search_jimaku_subtitles,
)
from backend.settings import current_settings

library_subtitle_bp = Blueprint("library_subtitle", __name__)


@library_subtitle_bp.route("/library/episodes/<int:episode_id>/subtitles/search", methods=["GET"])
def library_episode_subtitle_search(episode_id):
    context_result = get_episode_subtitle_context(current_settings().library_db_path, episode_id)
    if not context_result.get("found"):
        return jsonify({"error": "Episode not found"}), 404

    context = context_result["context"]
    query = request.args.get("q") or context["series_title"]

    try:
        results = search_jimaku_subtitles(query, context.get("episode_number"))
    except urllib.error.HTTPError as err:
        return jsonify({"error": f"Jimaku request failed: HTTP {err.code}"}), 502
    except Exception as err:
        return jsonify({"error": str(err)}), 502

    return jsonify({
        "episodeId": episode_id,
        "seriesTitle": context["series_title"],
        "episodeNumber": context.get("episode_number"),
        "query": query,
        "results": results,
    })


@library_subtitle_bp.route("/library/episodes/<int:episode_id>/subtitles/select", methods=["POST"])
def library_episode_subtitle_select(episode_id):
    data = request.get_json(silent=True) or {}

    try:
        result = download_and_save_jimaku_subtitle(
            db_path=current_settings().library_db_path,
            episode_id=episode_id,
            payload=data,
        )
    except urllib.error.HTTPError as err:
        payload = {"error": f"Jimaku download failed: HTTP {err.code}"}
        retry_after = err.headers.get("Retry-After") if err.headers else None
        if retry_after:
            payload["retryAfter"] = retry_after
        return jsonify(payload), err.code if err.code == 429 else 502
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, **result})


@library_subtitle_bp.route("/library/series/<int:series_id>/subtitles/missing", methods=["POST"])
def library_series_missing_subtitles(series_id):
    data = request.get_json(silent=True) or {}
    limit = data.get("limit")

    try:
        result = get_missing_jimaku_subtitle_candidates(
            db_path=current_settings().library_db_path,
            series_id=series_id,
            limit=limit,
        )
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_subtitle_bp.route("/library/series/<int:series_id>/subtitles/analyze", methods=["POST"])
def library_series_subtitles_analyze(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = build_series_jimaku_subtitle_analysis(
            db_path=current_settings().library_db_path,
            series_id=series_id,
            query=query,
            limit=limit,
        )
    except urllib.error.HTTPError as err:
        payload = {"error": f"Jimaku request failed: HTTP {err.code}"}
        retry_after = err.headers.get("Retry-After") if err.headers else None
        if retry_after:
            payload["retryAfter"] = retry_after
        return jsonify(payload), err.code if err.code == 429 else 502
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_subtitle_bp.route("/library/episodes/<int:episode_id>/subtitles/plan", methods=["POST"])
def library_episode_subtitle_plan(episode_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")

    try:
        result = build_episode_jimaku_subtitle_plan(
            db_path=current_settings().library_db_path,
            episode_id=episode_id,
            query=query,
        )
    except urllib.error.HTTPError as err:
        payload = {"error": f"Jimaku request failed: HTTP {err.code}"}
        retry_after = err.headers.get("Retry-After") if err.headers else None
        if retry_after:
            payload["retryAfter"] = retry_after
        return jsonify(payload), err.code if err.code == 429 else 502
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, **result})


@library_subtitle_bp.route("/library/series/<int:series_id>/subtitles/download-plan", methods=["POST"])
def library_series_subtitles_download_plan(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = build_missing_jimaku_subtitle_plan(
            db_path=current_settings().library_db_path,
            series_id=series_id,
            query=query,
            limit=limit,
        )
    except urllib.error.HTTPError as err:
        return jsonify({"error": f"Jimaku request failed: HTTP {err.code}"}), 502
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_subtitle_bp.route("/library/series/<int:series_id>/subtitles/download-missing", methods=["POST"])
def library_series_subtitles_download_missing(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = bulk_download_missing_jimaku_subtitles(
            db_path=current_settings().library_db_path,
            series_id=series_id,
            query=query,
            limit=limit,
        )
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})
