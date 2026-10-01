"""Library subtitle routes."""

import urllib.error

from backend.api_response import exception_response

from flask import Blueprint, jsonify, request

from backend.library_subtitles import (
    build_episode_jimaku_subtitle_plan,
    build_series_jimaku_subtitle_analysis,
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
        return exception_response(err)

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
        return exception_response(err)

    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
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
        return exception_response(err)

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
        return exception_response(err)

    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    return jsonify({"ok": True, **result})




