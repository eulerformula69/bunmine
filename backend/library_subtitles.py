import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from backend.config import ALLOWED_SUBTITLE_EXTENSIONS, JIMAKU_API_TOKEN, MEDIA_LIBRARY_DIR
from backend.library_db import get_db, get_library_series_detail
from backend.library_scanner import normalize_title
from backend.utils_validation import is_within


JIMAKU_BASE_URL = "https://jimaku.cc"
JIMAKU_API_BASE_URL = f"{JIMAKU_BASE_URL}/api"
JIMAKU_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
JIMAKU_SERIES_ENTRY_LIMIT = 6

SUPPORTED_JIMAKU_SUBTITLE_EXTENSIONS = {
    ext for ext in ALLOWED_SUBTITLE_EXTENSIONS if ext in {".srt", ".ass", ".vtt"}
}


def _http_json_get(url: str, token: str | None = None, timeout: int = 12) -> object:
    headers = {"Accept": "application/json", "User-Agent": "Bunmine/1.0"}
    if token:
        headers["Authorization"] = token
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def _init_jimaku_cache_table(db_path: Path) -> None:
    with get_db(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jimaku_cache (
                cache_key TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )


def _cached_http_json_get(db_path: Path, url: str, token: str | None = None, timeout: int = 12, ttl_seconds: int = JIMAKU_CACHE_TTL_SECONDS) -> object:
    """GET Jimaku JSON with a tiny SQLite cache.

    Jimaku rate-limits fairly quickly. Bulk subtitle analysis should therefore
    reuse recent search/file responses instead of re-querying the API whenever
    the user reopens the modal or tweaks a subtitle set.
    """
    _init_jimaku_cache_table(db_path)
    now = int(time.time())
    cache_key = url

    with get_db(db_path) as conn:
        row = conn.execute(
            "SELECT response_json, created_at FROM jimaku_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        if row and now - int(row["created_at"] or 0) <= ttl_seconds:
            return json.loads(row["response_json"])

    data = _http_json_get(url, token=token, timeout=timeout)

    with get_db(db_path) as conn:
        conn.execute(
            """
            INSERT INTO jimaku_cache(cache_key, url, response_json, created_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                url = excluded.url,
                response_json = excluded.response_json,
                created_at = excluded.created_at
            """,
            (cache_key, url, json.dumps(data, ensure_ascii=False), now),
        )

    return data


def _http_download(url: str, token: str | None = None, timeout: int = 30) -> bytes:
    headers = {"Accept": "text/plain,application/octet-stream,*/*", "User-Agent": "Bunmine/1.0"}
    if token:
        headers["Authorization"] = token
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _safe_subtitle_name(value: str) -> str:
    value = str(value or "")
    value = re.sub(r"[^a-zA-Z0-9_. -]+", "_", value).strip(" ._-")
    return value or "subtitle"


def _episode_label(value: float | int | None) -> str:
    if value is None:
        return "unknown"
    value = float(value)
    if value.is_integer():
        return f"{int(value):02d}"
    return f"{value:g}"



def _compact_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _release_tokens_from_filename(filename: str, entry_title: str | None = None) -> list[str]:
    """Extract stable release/source tokens from a Jimaku subtitle filename.

    The goal is not a perfect parser. It is to avoid mixing obviously different
    timing families in bulk download review: Netflix/NF vs DSNP, EMBER vs KMPL,
    WEB-DL vs BDRip, etc.
    """
    raw = str(filename or "")
    lowered = raw.lower()
    tokens: list[str] = []

    def add(label: str, *needles: str) -> None:
        for needle in needles:
            if needle and needle in lowered:
                if label not in tokens:
                    tokens.append(label)
                return

    # Leading fansub/release group markers, e.g. [EMBER], [SubsPlease].
    leading_group = re.match(r"^\s*\[([^\]]{2,32})\]", raw)
    if leading_group:
        group = leading_group.group(1).strip()
        if group:
            tokens.append(group)

    add("Netflix", "netflix", " nf ", ".nf.", "-nf-", "[nf]", "nf-web", "web-dl.nf")
    add("DSNP", "dsnp", "disney", "disney+")
    add("Amazon", "amzn", "amazon")
    add("Crunchyroll", "crunchy", "cr-web", "crunchyroll")
    add("B-Global", "b-global", "bglobal", "b global")
    add("Baha", "baha")
    add("Hulu", "hulu")

    add("WEB-DL", "web-dl", "webdl")
    add("WEBRip", "webrip", "web rip")
    add("BluRay", "bluray", "blu-ray", "bdrip", "bdremux")
    add("HDTV", "hdtv")

    add("1080p", "1080p")
    add("720p", "720p")
    add("2160p", "2160p", "4k")
    add("HEVC", "hevc", "x265", "h.265", "h265")
    add("H.264", "h.264", "h264", "x264", "avc")
    add("DDP", "ddp", "eac3", "e-ac-3")
    add("AAC", "aac")

    add("JP", " japanese", ".jpn", ".jp.", " ja[", ".ja.", " ja-")
    add("CC", "[cc]", ".cc.", " cc ", "closed caption")

    # If nothing obvious was found, fall back to the Jimaku entry title so that
    # files from the same entry still group together instead of becoming random.
    if not tokens:
        fallback = str(entry_title or "").strip()
        if fallback:
            tokens.append(fallback[:60])
        else:
            stem = re.sub(r"\.(srt|ass|vtt)$", "", raw, flags=re.IGNORECASE)
            stem = re.sub(r"[Ss]\d{1,2}[Ee]\d{1,3}", " ", stem)
            stem = re.sub(r"(?<!\d)\d{1,3}(?!\d)", " ", stem)
            stem = re.sub(r"\s+", " ", stem).strip()
            tokens.append(stem[:60] or "Other")

    # De-duplicate by compact value, preserving display labels and order.
    result: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        key = _compact_token(token)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(token)
    return result


def _release_info_from_candidate(filename: str, entry_title: str | None = None) -> dict:
    tokens = _release_tokens_from_filename(filename, entry_title)
    label = " · ".join(tokens[:6]) if tokens else "Other"
    key = "|".join(_compact_token(token) for token in tokens if _compact_token(token)) or "other"
    return {"releaseKey": key, "releaseLabel": label, "releaseTokens": tokens}

def _extension_from_filename(filename: str) -> str:
    lowered = filename.lower()
    for ext in sorted(SUPPORTED_JIMAKU_SUBTITLE_EXTENSIONS, key=len, reverse=True):
        if lowered.endswith(ext):
            return ext
    return ""


def _is_jimaku_download_url(url: str, entry_id: int | str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    if parsed.scheme != "https" or parsed.netloc != "jimaku.cc":
        return False
    return parsed.path.startswith(f"/entry/{entry_id}/download/")


def _auth_token() -> str | None:
    return str(JIMAKU_API_TOKEN or "").strip() or None


def get_episode_subtitle_context(db_path: Path, episode_id: int) -> dict:
    with get_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT
                e.id AS episode_id,
                e.title AS episode_title,
                e.episode_number,
                e.season_number,
                s.id AS series_id,
                s.title AS series_title,
                vf.id AS video_file_id,
                vf.path AS video_path,
                sf.id AS subtitle_file_id
            FROM episodes e
            JOIN series s ON s.id = e.series_id
            LEFT JOIN library_files vf ON vf.id = (
                SELECT id FROM library_files
                WHERE episode_id = e.id AND file_type = 'video' AND file_exists = 1
                ORDER BY is_primary DESC, id ASC
                LIMIT 1
            )
            LEFT JOIN library_files sf ON sf.id = (
                SELECT id FROM library_files
                WHERE episode_id = e.id AND file_type = 'subtitle' AND file_exists = 1
                ORDER BY is_primary DESC, id ASC
                LIMIT 1
            )
            WHERE e.id = ?
            """,
            (episode_id,),
        ).fetchone()
        if not row:
            return {"found": False, "context": None}
        return {"found": True, "context": dict(row)}


def _build_jimaku_search_queries(series_title: str) -> list[str]:
    title = str(series_title or "").strip()
    normalized = normalize_title(title)
    queries = []
    for candidate in [title, normalized]:
        candidate = candidate.strip()
        if candidate and candidate not in queries:
            queries.append(candidate)
    return queries


def _search_jimaku_entries(series_title: str, db_path: Path | None = None) -> dict[int, dict]:
    token = _auth_token()
    if not token:
        raise RuntimeError("JIMAKU_API_TOKEN is not set. Add it to .env to use Jimaku subtitle search.")

    entries_by_id: dict[int, dict] = {}
    for query in _build_jimaku_search_queries(series_title):
        url = f"{JIMAKU_API_BASE_URL}/entries/search?anime=true&query={urllib.parse.quote(query)}"
        data = _cached_http_json_get(db_path, url, token=token) if db_path else _http_json_get(url, token=token)
        if not isinstance(data, list):
            continue
        for entry in data[:8]:
            entry_id = entry.get("id")
            if entry_id is None:
                continue
            entries_by_id[int(entry_id)] = entry
    return entries_by_id


def _get_jimaku_entry_files(entry_id: int, token: str, db_path: Path | None = None, episode_number: float | int | None = None) -> list[dict]:
    files_url = f"{JIMAKU_API_BASE_URL}/entries/{entry_id}/files"
    if episode_number is not None:
        episode_query = int(episode_number) if float(episode_number).is_integer() else episode_number
        files_url += f"?episode={urllib.parse.quote(str(episode_query))}"

    files = _cached_http_json_get(db_path, files_url, token=token) if db_path else _http_json_get(files_url, token=token)
    return files if isinstance(files, list) else []


def _candidate_from_jimaku_file(file_item: dict, entry_id: int, entry: dict, series_title: str, episode_number: float | int | None = None) -> dict | None:
    name = str(file_item.get("name") or "")
    download_url = str(file_item.get("url") or "")
    ext = _extension_from_filename(name)
    if not ext or not download_url:
        return None
    if not _is_jimaku_download_url(download_url, entry_id):
        return None

    entry_title = entry.get("name") or entry.get("english_name") or entry.get("japanese_name") or series_title
    release_info = _release_info_from_candidate(name, entry_title)
    return {
        "source": "jimaku",
        "entryId": entry_id,
        "entryTitle": entry_title,
        "filename": name,
        "downloadUrl": download_url,
        "extension": ext,
        "sizeBytes": int(file_item.get("size") or 0),
        "lastModified": file_item.get("last_modified"),
        "episodeNumber": episode_number,
        **release_info,
    }


def _score_subtitle_candidate(item: dict, episode_number: float | int | None = None, video_filename: str | None = None) -> tuple[int, int, str]:
    name = str(item.get("filename") or "").lower()
    subtitle_ext = str(item.get("extension") or "")
    format_score = 0 if subtitle_ext == ".srt" else 1 if subtitle_ext == ".ass" else 2

    ep = _episode_label(episode_number)
    ep_raw = ep.lstrip("0") or ep
    episode_score = 0 if ep != "unknown" and re.search(rf"(?<!\d){re.escape(ep_raw)}(?!\d)", name) else 1

    video_score = 0
    if video_filename:
        candidate_tokens = set(_release_tokens_from_filename(str(item.get("filename") or ""), str(item.get("entryTitle") or "")))
        video_tokens = set(_release_tokens_from_filename(video_filename, None))
        shared = {_compact_token(token) for token in candidate_tokens} & {_compact_token(token) for token in video_tokens}
        # Sort descending by shared token count by converting it to a negative score.
        video_score = -len([token for token in shared if token])

    return (video_score, episode_score, format_score, name)


def _infer_episode_number_from_filename(filename: str) -> float | None:
    name = str(filename or "")
    sxe = re.search(r"[Ss](\d{1,2})[Ee](\d{1,3})(?:\D|$)", name)
    if sxe:
        return float(int(sxe.group(2)))

    # Common anime forms: " - 06 ", "[06]", "Episode 06".
    patterns = [
        r"(?:^|[\s._\[-])(?:ep|episode)?[\s._-]*(\d{1,3})(?:v\d+)?(?:\D|$)",
        r"\[(\d{1,3})(?:v\d+)?\]",
    ]
    for pattern in patterns:
        for raw in re.findall(pattern, name, flags=re.IGNORECASE):
            try:
                value = int(raw)
            except (TypeError, ValueError):
                continue
            if 1 <= value <= 200:
                return float(value)
    return None


def _episode_numbers_equal(left, right) -> bool:
    if left is None or right is None:
        return False
    try:
        return abs(float(left) - float(right)) < 0.001
    except (TypeError, ValueError):
        return False


def get_missing_subtitle_episode_contexts(db_path: Path, series_id: int, limit: int | None = None) -> dict:
    with get_db(db_path) as conn:
        series = conn.execute("SELECT id, title FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series:
            return {"found": False, "series": None, "episodes": []}

        rows = conn.execute(
            """
            SELECT
                e.id AS episode_id,
                e.title AS episode_title,
                e.episode_number,
                e.season_number,
                vf.id AS video_file_id,
                vf.path AS video_path
            FROM episodes e
            JOIN library_files vf ON vf.id = (
                SELECT id FROM library_files
                WHERE episode_id = e.id AND file_type = 'video' AND file_exists = 1
                ORDER BY is_primary DESC, id ASC
                LIMIT 1
            )
            LEFT JOIN library_files sf ON sf.id = (
                SELECT id FROM library_files
                WHERE episode_id = e.id AND file_type = 'subtitle' AND file_exists = 1
                ORDER BY is_primary DESC, id ASC
                LIMIT 1
            )
            WHERE e.series_id = ? AND sf.id IS NULL
            ORDER BY COALESCE(e.season_number, 1), e.episode_number IS NULL, e.episode_number, e.title
            """,
            (series_id,),
        ).fetchall()

    episodes = [dict(row) for row in rows]
    if limit is not None:
        episodes = episodes[:max(0, int(limit))]
    return {"found": True, "series": dict(series), "episodes": episodes}


def search_jimaku_subtitles(series_title: str, episode_number: float | int | None) -> list[dict]:
    token = _auth_token()
    if not token:
        raise RuntimeError("JIMAKU_API_TOKEN is not set. Add it to .env to use Jimaku subtitle search.")

    entries_by_id = _search_jimaku_entries(series_title)
    results: list[dict] = []
    seen_urls: set[str] = set()

    for entry_id, entry in entries_by_id.items():
        files = _get_jimaku_entry_files(entry_id, token=token, episode_number=episode_number)
        for file_item in files:
            candidate = _candidate_from_jimaku_file(file_item, entry_id, entry, series_title, episode_number)
            if not candidate:
                continue
            download_url = str(candidate.get("downloadUrl") or "")
            if download_url in seen_urls:
                continue
            seen_urls.add(download_url)
            results.append(candidate)

    results.sort(key=lambda item: _score_subtitle_candidate(item, episode_number))
    return results[:30]

def _target_subtitle_path(video_path: Path, source: str, entry_id: int | str, original_filename: str) -> Path:
    ext = _extension_from_filename(original_filename)
    if not ext:
        raise ValueError("Unsupported subtitle format")

    # Keep subtitles predictable and compatible with common players:
    # Episode.mkv -> Episode.srt / Episode.ass / Episode.vtt
    # The source/id are still stored in DB metadata through the library_files row.
    target = video_path.with_name(f"{video_path.stem}{ext}").resolve()
    if not is_within(MEDIA_LIBRARY_DIR, target):
        raise ValueError("Subtitle target path is outside MEDIA_LIBRARY_DIR")
    return target


def download_and_save_jimaku_subtitle(db_path: Path, episode_id: int, payload: dict) -> dict:
    source = payload.get("source")
    entry_id = payload.get("entryId")
    download_url = payload.get("downloadUrl")
    filename = payload.get("filename")

    if source != "jimaku":
        raise ValueError("Unsupported subtitle source")
    if not entry_id or not download_url or not filename:
        raise ValueError("entryId, filename and downloadUrl are required")
    if not _is_jimaku_download_url(str(download_url), entry_id):
        raise ValueError("Invalid Jimaku download URL")

    context_result = get_episode_subtitle_context(db_path, episode_id)
    if not context_result.get("found"):
        return {"found": False, "subtitleFileId": None}

    context = context_result["context"]
    if not context.get("video_path"):
        raise ValueError("Video file is missing for this episode")

    video_path = Path(context["video_path"]).resolve()
    if not video_path.exists() or not is_within(MEDIA_LIBRARY_DIR, video_path):
        raise ValueError("Video file is missing or outside MEDIA_LIBRARY_DIR")

    target_path = _target_subtitle_path(video_path, source, entry_id, str(filename))
    data = _http_download(str(download_url), token=_auth_token())
    if not data:
        raise ValueError("Downloaded subtitle is empty")
    if len(data) > 5 * 1024 * 1024:
        raise ValueError("Downloaded subtitle is too large")

    target_path.write_bytes(data)
    relative_path = str(target_path.relative_to(MEDIA_LIBRARY_DIR))

    with get_db(db_path) as conn:
        row = conn.execute("SELECT id FROM library_files WHERE path = ?", (str(target_path),)).fetchone()
        if row:
            subtitle_file_id = int(row["id"])
            conn.execute(
                """
                UPDATE library_files
                SET series_id = ?, episode_id = ?, file_type = 'subtitle', relative_path = ?, file_exists = 1,
                    is_primary = 1, missing_since = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (context["series_id"], episode_id, relative_path, subtitle_file_id),
            )
        else:
            cur = conn.execute(
                """
                INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary, linked_at)
                VALUES(?, ?, 'subtitle', ?, ?, 1, 1, CURRENT_TIMESTAMP)
                """,
                (context["series_id"], episode_id, str(target_path), relative_path),
            )
            subtitle_file_id = int(cur.lastrowid)

    return {
        "found": True,
        "subtitleFileId": subtitle_file_id,
        "subtitlePath": str(target_path),
        "subtitleUrl": f"/library/file/{subtitle_file_id}",
    }



def get_missing_jimaku_subtitle_candidates(db_path: Path, series_id: int, limit: int | None = None) -> dict:
    """Return episodes that need subtitles without touching Jimaku.

    This lets the frontend build a visible queue first and then query Jimaku
    gradually, one episode at a time, instead of sending a burst of requests.
    """
    detail = get_library_series_detail(db_path, series_id)
    if not detail.get("found"):
        return {"found": False}

    series = detail["series"]
    episodes = detail.get("episodes") or []
    candidates = [episode for episode in episodes if episode.get("hasVideo") and not episode.get("hasSubtitle")]
    if limit is not None:
        candidates = candidates[:max(0, int(limit))]

    return {
        "found": True,
        "seriesId": series_id,
        "seriesTitle": series.get("title"),
        "checked": len(candidates),
        "items": [
            {
                "episodeId": episode.get("id"),
                "episodeNumber": episode.get("episodeNumber"),
                "episodeTitle": episode.get("title"),
                "status": "pending",
                "message": "Waiting to search Jimaku",
                "selected": None,
                "alternativesCount": 0,
            }
            for episode in candidates
        ],
    }


def build_episode_jimaku_subtitle_plan(db_path: Path, episode_id: int, query: str | None = None) -> dict:
    """Find one best Jimaku subtitle candidate for one episode.

    No file is downloaded here. This endpoint is intentionally per-episode so
    the UI can throttle requests and avoid Jimaku 429 responses.
    """
    context_result = get_episode_subtitle_context(db_path, episode_id)
    if not context_result.get("found"):
        return {"found": False}

    context = context_result["context"]
    item = {
        "episodeId": episode_id,
        "episodeNumber": context.get("episode_number"),
        "episodeTitle": context.get("episode_title"),
        "videoFilename": Path(context.get("video_path") or "").name if context.get("video_path") else None,
        "status": "skipped",
        "message": "",
        "selected": None,
        "candidates": [],
        "alternativesCount": 0,
    }

    if not context.get("video_file_id"):
        item["status"] = "skipped"
        item["message"] = "Video file is missing"
        return {"found": True, "item": item}

    if context.get("subtitle_file_id"):
        item["status"] = "skipped"
        item["message"] = "Subtitle already exists"
        return {"found": True, "item": item}

    search_query = str(query or context.get("series_title") or "").strip()
    results = search_jimaku_subtitles(search_query, context.get("episode_number"))
    item["alternativesCount"] = len(results)
    item["candidates"] = results
    if not results:
        item["status"] = "skipped"
        item["message"] = "No matching Jimaku subtitle found"
    else:
        item["status"] = "needs-review"
        item["message"] = "Choose a subtitle set or select a file manually"
        item["selected"] = None

    return {"found": True, "item": item}


def build_series_jimaku_subtitle_analysis(db_path: Path, series_id: int, query: str | None = None, limit: int | None = None) -> dict:
    """Analyze missing subtitles for a whole series with fewer Jimaku requests.

    Instead of searching Jimaku once per episode, this does one series search,
    fetches file lists for the top matching entries, and distributes files to
    local episodes by inferred episode number. Responses are cached in SQLite.
    """
    missing = get_missing_subtitle_episode_contexts(db_path, series_id, limit=limit)
    if not missing.get("found"):
        return {"found": False}

    series = missing["series"]
    episodes = missing.get("episodes") or []
    search_query = str(query or series.get("title") or "").strip()

    items = [
        {
            "episodeId": episode.get("episode_id"),
            "episodeNumber": episode.get("episode_number"),
            "episodeTitle": episode.get("episode_title"),
            "videoFilename": Path(episode.get("video_path") or "").name if episode.get("video_path") else None,
            "status": "pending",
            "message": "Waiting for series-level Jimaku analysis",
            "selected": None,
            "candidates": [],
            "alternativesCount": 0,
        }
        for episode in episodes
    ]

    if not episodes:
        return {
            "found": True,
            "seriesId": series_id,
            "seriesTitle": series.get("title"),
            "query": search_query,
            "checked": 0,
            "items": [],
            "cacheTtlSeconds": JIMAKU_CACHE_TTL_SECONDS,
            "mode": "series-analyze",
        }

    token = _auth_token()
    if not token:
        raise RuntimeError("JIMAKU_API_TOKEN is not set. Add it to .env to use Jimaku subtitle search.")

    entries_by_id = _search_jimaku_entries(search_query, db_path=db_path)
    entries = list(entries_by_id.items())[:JIMAKU_SERIES_ENTRY_LIMIT]

    all_candidates: list[dict] = []
    seen_urls: set[str] = set()
    for entry_id, entry in entries:
        files = _get_jimaku_entry_files(entry_id, token=token, db_path=db_path)
        for file_item in files:
            inferred_episode = _infer_episode_number_from_filename(str(file_item.get("name") or ""))
            candidate = _candidate_from_jimaku_file(file_item, entry_id, entry, search_query, inferred_episode)
            if not candidate:
                continue
            download_url = str(candidate.get("downloadUrl") or "")
            if download_url in seen_urls:
                continue
            seen_urls.add(download_url)
            all_candidates.append(candidate)

    for item in items:
        episode_number = item.get("episodeNumber")
        video_filename = item.get("videoFilename")
        candidates = [
            candidate
            for candidate in all_candidates
            if _episode_numbers_equal(candidate.get("episodeNumber"), episode_number)
        ]
        candidates.sort(key=lambda candidate: _score_subtitle_candidate(candidate, episode_number, video_filename))
        item["candidates"] = candidates[:30]
        item["alternativesCount"] = len(candidates)
        if candidates:
            item["status"] = "needs-review"
            item["message"] = "Choose a subtitle set or select a file manually"
        else:
            item["status"] = "skipped"
            item["message"] = "No matching Jimaku subtitle found in series entries"

    return {
        "found": True,
        "seriesId": series_id,
        "seriesTitle": series.get("title"),
        "query": search_query,
        "checked": len(items),
        "items": items,
        "entriesChecked": len(entries),
        "filesChecked": len(all_candidates),
        "cacheTtlSeconds": JIMAKU_CACHE_TTL_SECONDS,
        "mode": "series-analyze",
    }


def build_missing_jimaku_subtitle_plan(db_path: Path, series_id: int, query: str | None = None, limit: int | None = None) -> dict:
    """Build a reviewable download plan without downloading any files.

    The frontend shows this plan to the user and then downloads selected
    items one-by-one through the existing single-subtitle select endpoint.
    """
    detail = get_library_series_detail(db_path, series_id)
    if not detail.get("found"):
        return {"found": False}

    series = detail["series"]
    episodes = detail.get("episodes") or []
    candidates = [episode for episode in episodes if episode.get("hasVideo") and not episode.get("hasSubtitle")]
    if limit is not None:
        candidates = candidates[:max(0, int(limit))]

    search_query = str(query or series.get("title") or "").strip()
    plan_items: list[dict] = []
    ready_count = 0
    skipped_count = 0
    failed_count = 0

    for episode in candidates:
        item = {
            "episodeId": episode.get("id"),
            "episodeNumber": episode.get("episodeNumber"),
            "episodeTitle": episode.get("title"),
            "status": "skipped",
            "message": "",
            "selected": None,
            "alternativesCount": 0,
        }

        try:
            results = search_jimaku_subtitles(search_query, episode.get("episodeNumber"))
            item["alternativesCount"] = len(results)
            if not results:
                item["status"] = "skipped"
                item["message"] = "No matching Jimaku subtitle found"
                skipped_count += 1
            else:
                item["status"] = "ready"
                item["message"] = "Ready to download"
                item["selected"] = results[0]
                ready_count += 1
        except Exception as err:
            item["status"] = "failed"
            item["message"] = str(err)
            failed_count += 1

        plan_items.append(item)

    return {
        "found": True,
        "seriesId": series_id,
        "seriesTitle": series.get("title"),
        "query": search_query,
        "checked": len(candidates),
        "ready": ready_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "items": plan_items,
    }


def bulk_download_missing_jimaku_subtitles(db_path: Path, series_id: int, query: str | None = None, limit: int | None = None) -> dict:
    detail = get_library_series_detail(db_path, series_id)
    if not detail.get("found"):
        return {"found": False}

    series = detail["series"]
    episodes = detail.get("episodes") or []
    candidates = [episode for episode in episodes if episode.get("hasVideo") and not episode.get("hasSubtitle")]
    if limit is not None:
        candidates = candidates[:max(0, int(limit))]

    summary = {
        "found": True,
        "seriesId": series_id,
        "seriesTitle": series.get("title"),
        "checked": len(candidates),
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "items": [],
    }

    search_query = str(query or series.get("title") or "").strip()
    for episode in candidates:
        item = {
            "episodeId": episode.get("id"),
            "episodeNumber": episode.get("episodeNumber"),
            "episodeTitle": episode.get("title"),
            "status": "skipped",
            "message": "",
            "subtitleFileId": None,
        }

        try:
            results = search_jimaku_subtitles(search_query, episode.get("episodeNumber"))
            if not results:
                item["status"] = "skipped"
                item["message"] = "No matching Jimaku subtitle found"
                summary["skipped"] += 1
            else:
                chosen = results[0]
                saved = download_and_save_jimaku_subtitle(db_path, int(episode["id"]), chosen)
                if saved.get("found"):
                    item["status"] = "downloaded"
                    item["message"] = chosen.get("filename") or "Downloaded"
                    item["subtitleFileId"] = saved.get("subtitleFileId")
                    summary["downloaded"] += 1
                else:
                    item["status"] = "failed"
                    item["message"] = "Episode disappeared from DB"
                    summary["failed"] += 1
        except Exception as err:
            item["status"] = "failed"
            item["message"] = str(err)
            summary["failed"] += 1

        summary["items"].append(item)

    return summary
