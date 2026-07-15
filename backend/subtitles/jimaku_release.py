import re


def compact_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def release_tokens(filename: str, entry_title: str | None = None) -> list[str]:
    raw = str(filename or "")
    lowered = raw.lower()
    tokens: list[str] = []

    def add(label: str, *needles: str) -> None:
        if any(needle and needle in lowered for needle in needles) and label not in tokens:
            tokens.append(label)

    leading_group = re.match(r"^\s*\[([^\]]{2,32})\]", raw)
    if leading_group and leading_group.group(1).strip():
        tokens.append(leading_group.group(1).strip())

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

    if not tokens:
        fallback = str(entry_title or "").strip()
        if fallback:
            tokens.append(fallback[:60])
        else:
            stem = re.sub(r"\.(srt|ass|vtt)$", "", raw, flags=re.IGNORECASE)
            stem = re.sub(r"[Ss]\d{1,2}[Ee]\d{1,3}", " ", stem)
            stem = re.sub(r"(?<!\d)\d{1,3}(?!\d)", " ", stem)
            tokens.append(re.sub(r"\s+", " ", stem).strip()[:60] or "Other")

    result: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        key = compact_token(token)
        if key and key not in seen:
            seen.add(key)
            result.append(token)
    return result


def release_info(filename: str, entry_title: str | None = None) -> dict:
    tokens = release_tokens(filename, entry_title)
    label = " · ".join(tokens[:6]) if tokens else "Other"
    key = "|".join(compact_token(token) for token in tokens if compact_token(token)) or "other"
    return {"releaseKey": key, "releaseLabel": label, "releaseTokens": tokens}


def infer_episode_number(filename: str) -> float | None:
    name = str(filename or "")
    season_episode = re.search(r"[Ss](\d{1,2})[Ee](\d{1,3})(?:\D|$)", name)
    if season_episode:
        return float(int(season_episode.group(2)))

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


def episode_numbers_equal(left, right) -> bool:
    if left is None or right is None:
        return False
    try:
        return abs(float(left) - float(right)) < 0.001
    except (TypeError, ValueError):
        return False


def score_candidate(
    item: dict,
    episode_number: float | int | None = None,
    video_filename: str | None = None,
) -> tuple[int, int, int, str]:
    name = str(item.get("filename") or "").lower()
    subtitle_ext = str(item.get("extension") or "")
    format_score = 0 if subtitle_ext == ".srt" else 1 if subtitle_ext == ".ass" else 2

    episode_label = "unknown"
    if episode_number is not None:
        numeric_episode = float(episode_number)
        episode_label = f"{int(numeric_episode):02d}" if numeric_episode.is_integer() else f"{numeric_episode:g}"
    episode_raw = episode_label.lstrip("0") or episode_label
    episode_score = 0 if episode_label != "unknown" and re.search(
        rf"(?<!\d){re.escape(episode_raw)}(?!\d)", name
    ) else 1

    video_score = 0
    if video_filename:
        candidate_tokens = set(release_tokens(str(item.get("filename") or ""), str(item.get("entryTitle") or "")))
        video_tokens = set(release_tokens(video_filename))
        shared = {compact_token(token) for token in candidate_tokens} & {
            compact_token(token) for token in video_tokens
        }
        video_score = -len([token for token in shared if token])

    return video_score, episode_score, format_score, name
