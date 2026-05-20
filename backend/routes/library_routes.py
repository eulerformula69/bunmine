import urllib.error
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory

from backend.config import (
    ALLOWED_SUBTITLE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    LIBRARY_COVERS_DIR,
    LIBRARY_DB_PATH,
    MEDIA_LIBRARY_DIR,
)
from backend.library_covers import get_series_cover_file, resolve_cover_file_path, save_series_cover, search_anilist_covers
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
from backend.library_db import (
    get_episode_playback,
    get_library_db_status,
    get_library_file_by_id,
    get_library_series_debug,
    get_library_series_detail,
    get_library_series_files_debug,
    get_library_series_list,
    save_episode_progress,
    set_episode_completed,
)
from backend.library_scanner import scan_library
from backend.utils_validation import is_within, to_float

library_bp = Blueprint("library", __name__)


@library_bp.route("/library/config", methods=["GET"])
def library_config():
    return jsonify({
        "mediaLibraryDir": str(MEDIA_LIBRARY_DIR),
        "exists": MEDIA_LIBRARY_DIR.exists(),
        "isDirectory": MEDIA_LIBRARY_DIR.is_dir(),
        "videoExtensions": sorted(ALLOWED_VIDEO_EXTENSIONS),
        "subtitleExtensions": sorted(ALLOWED_SUBTITLE_EXTENSIONS),
    })


@library_bp.route("/library/db/status", methods=["GET"])
def library_db_status():
    return jsonify(get_library_db_status(LIBRARY_DB_PATH))


@library_bp.route("/library/scan", methods=["GET"])
def library_scan():
    result = scan_library(
        db_path=LIBRARY_DB_PATH,
        media_root=MEDIA_LIBRARY_DIR,
        video_extensions=ALLOWED_VIDEO_EXTENSIONS,
        subtitle_extensions=ALLOWED_SUBTITLE_EXTENSIONS,
    )
    status_code = 200 if result.get("ok") else 400
    return jsonify(result), status_code


@library_bp.route("/library/debug/series", methods=["GET"])
def library_debug_series():
    return jsonify({"series": get_library_series_debug(LIBRARY_DB_PATH)})


@library_bp.route("/library/debug/series/<int:series_id>/files", methods=["GET"])
def library_debug_series_files(series_id):
    result = get_library_series_files_debug(LIBRARY_DB_PATH, series_id)
    status_code = 200 if result.get("found") else 404
    return jsonify(result), status_code


@library_bp.route("/library/series", methods=["GET"])
def library_series_list():
    return jsonify({"series": get_library_series_list(LIBRARY_DB_PATH)})


@library_bp.route("/library/series/<int:series_id>", methods=["GET"])
def library_series_detail(series_id):
    result = get_library_series_detail(LIBRARY_DB_PATH, series_id)
    status_code = 200 if result.get("found") else 404
    return jsonify(result), status_code


@library_bp.route("/library/episodes/<int:episode_id>/playback", methods=["GET"])
def library_episode_playback(episode_id):
    result = get_episode_playback(LIBRARY_DB_PATH, episode_id)
    if not result.get("found"):
        return jsonify({"error": "Episode not found"}), 404
    if result.get("error"):
        return jsonify({"error": result["error"]}), 404
    return jsonify(result["playback"])


@library_bp.route("/library/episodes/<int:episode_id>/progress", methods=["POST"])
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


@library_bp.route("/library/episodes/<int:episode_id>/completed", methods=["POST"])
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


@library_bp.route("/library/episodes/<int:episode_id>/subtitles/search", methods=["GET"])
def library_episode_subtitle_search(episode_id):
    context_result = get_episode_subtitle_context(LIBRARY_DB_PATH, episode_id)
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


@library_bp.route("/library/episodes/<int:episode_id>/subtitles/select", methods=["POST"])
def library_episode_subtitle_select(episode_id):
    data = request.get_json(silent=True) or {}

    try:
        result = download_and_save_jimaku_subtitle(
            db_path=LIBRARY_DB_PATH,
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


@library_bp.route("/library/series/<int:series_id>/subtitles/missing", methods=["POST"])
def library_series_missing_subtitles(series_id):
    data = request.get_json(silent=True) or {}
    limit = data.get("limit")

    try:
        result = get_missing_jimaku_subtitle_candidates(
            db_path=LIBRARY_DB_PATH,
            series_id=series_id,
            limit=limit,
        )
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_bp.route("/library/series/<int:series_id>/subtitles/analyze", methods=["POST"])
def library_series_subtitles_analyze(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = build_series_jimaku_subtitle_analysis(
            db_path=LIBRARY_DB_PATH,
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


@library_bp.route("/library/episodes/<int:episode_id>/subtitles/plan", methods=["POST"])
def library_episode_subtitle_plan(episode_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")

    try:
        result = build_episode_jimaku_subtitle_plan(
            db_path=LIBRARY_DB_PATH,
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


@library_bp.route("/library/series/<int:series_id>/subtitles/download-plan", methods=["POST"])
def library_series_subtitles_download_plan(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = build_missing_jimaku_subtitle_plan(
            db_path=LIBRARY_DB_PATH,
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


@library_bp.route("/library/series/<int:series_id>/subtitles/download-missing", methods=["POST"])
def library_series_subtitles_download_missing(series_id):
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    limit = data.get("limit")

    try:
        result = bulk_download_missing_jimaku_subtitles(
            db_path=LIBRARY_DB_PATH,
            series_id=series_id,
            query=query,
            limit=limit,
        )
    except Exception as err:
        return jsonify({"error": str(err)}), 500

    if not result.get("found"):
        return jsonify({"error": "Series not found"}), 404
    return jsonify({"ok": True, **result})


@library_bp.route("/library/file/<int:file_id>", methods=["GET"])
def serve_library_file(file_id):
    result = get_library_file_by_id(LIBRARY_DB_PATH, file_id)
    if not result.get("found"):
        return jsonify({"error": "File not found"}), 404

    file_path = Path(result["file"]["path"]).resolve()
    if not is_within(MEDIA_LIBRARY_DIR, file_path):
        return jsonify({"error": "File is outside MEDIA_LIBRARY_DIR"}), 403
    if not file_path.exists() or not file_path.is_file():
        return jsonify({"error": "File is missing"}), 404
    return send_from_directory(str(file_path.parent), file_path.name, as_attachment=False)


@library_bp.route("/library/series/<int:series_id>/cover/search", methods=["GET"])
def library_series_cover_search(series_id):
    detail = get_library_series_detail(LIBRARY_DB_PATH, series_id)
    if not detail.get("found"):
        return jsonify({"error": "Series not found"}), 404

    query = request.args.get("q") or detail["series"]["title"]
    try:
        results = search_anilist_covers(query)
    except urllib.error.HTTPError as err:
        return jsonify({"error": f"AniList request failed: HTTP {err.code}"}), 502
    except Exception as err:
        return jsonify({"error": str(err)}), 502

    return jsonify({"seriesId": series_id, "query": query, "results": results})


@library_bp.route("/library/series/<int:series_id>/cover/select", methods=["POST"])
def library_series_cover_select(series_id):
    data = request.get_json(silent=True) or {}
    source = data.get("source")
    external_id = data.get("externalId")
    cover_url = data.get("coverUrl")

    if source != "anilist":
        return jsonify({"error": "Unsupported cover source"}), 400
    if not external_id or not cover_url:
        return jsonify({"error": "externalId and coverUrl are required"}), 400

    try:
        result = save_series_cover(
            db_path=LIBRARY_DB_PATH,
            covers_dir=LIBRARY_COVERS_DIR,
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


@library_bp.route("/library/cover/<int:series_id>", methods=["GET"])
def library_series_cover(series_id):
    result = get_series_cover_file(LIBRARY_DB_PATH, series_id)
    if not result.get("found"):
        return jsonify({"error": "Cover not found"}), 404

    cover_path = resolve_cover_file_path(LIBRARY_COVERS_DIR, result["file"])
    if not cover_path:
        return jsonify({"error": "Cover file is missing"}), 404

    return send_from_directory(str(cover_path.parent), cover_path.name, as_attachment=False)




