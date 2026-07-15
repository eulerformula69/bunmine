from __future__ import annotations

import html
import re
from collections import Counter

STATUSES = {"not_in_anki", "new", "learning", "young", "mature", "suspended", "known_basic"}


def plain_anki_text(value: object) -> str:
    text = re.sub(r"\[sound:[^\]]+\]", "", str(value or ""), flags=re.I)
    text = re.sub(r"<\s*(br|div|p)\b[^>]*>", " ", text, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", text)).split())


def pick_sentence(fields: dict, names: list[str]) -> str:
    for name in names:
        field = fields.get(name, {}) if isinstance(fields, dict) else {}
        value = field.get("value") if isinstance(field, dict) else field
        cleaned = plain_anki_text(value)
        if cleaned:
            return cleaned
    return ""


def _match(token: dict, known: dict, known_basic: set[str]) -> tuple[str, dict, str]:
    surface, basic = str(token.get("surface") or ""), str(token.get("basic") or "")
    candidates = list(dict.fromkeys(token.get("candidates") or [surface, basic]))
    matches = [(candidate, known[candidate]) for candidate in candidates if candidate in known]
    if matches:
        word, info = sorted(matches, key=lambda pair: (candidates.index(pair[0]), str(pair[0])))[0]
        match_type = "exact" if word == surface else "basic_form" if word == basic else "inflected"
        return word, info if isinstance(info, dict) else {}, match_type
    for candidate in candidates:
        if candidate in known_basic:
            return candidate, {"status": "known_basic"}, "exact" if candidate == surface else "basic_form"
    return (basic if basic and basic != "*" else surface), {}, "unknown"


def build_report_rows(series: str, cues: list[dict], known: dict, known_basic: set[str], statuses: set[str]):
    occurrences, all_statuses, unique_statuses = [], Counter(), {}
    ignored_pos = {"記号", "フィラー"}
    for cue in cues:
        seen_positions = set()
        for token in cue.get("tokens", []):
            surface = str(token.get("surface") or "").strip()
            if not surface or token.get("pos") in ignored_pos or (token.get("pos") == "助詞" and len(surface) == 1):
                continue
            position_key = (cue.get("episodeId"), cue.get("start"), token.get("position"))
            if position_key in seen_positions:
                continue
            seen_positions.add(position_key)
            word, info, match_type = _match(token, known, known_basic)
            status = str(info.get("status") or "not_in_anki")
            if status not in STATUSES:
                status = "not_in_anki"
            all_statuses[status] += 1
            unique_statuses[word] = status
            if status not in statuses:
                continue
            occurrences.append({"series": series, "episode": cue.get("episode"), "episode_id": cue.get("episodeId"),
                "start": cue.get("start"), "end": cue.get("end"), "word": word, "surface": surface,
                "reading": token.get("reading") or "", "pos": token.get("pos") or "", "status": status,
                "sentence": cue.get("sentence") or "", "anki_sentence": info.get("sentence") or "",
                "deck": info.get("deck") or "", "note_id": info.get("noteId") or "",
                "card_ids": info.get("cardIds") or [], "match_type": match_type, "match_count": info.get("matchCount", 1)})
    grouped = {}
    for row in occurrences:
        item = grouped.setdefault(row["word"], {**row, "surfaces": set(), "episodes": set(), "count": 0})
        item["surfaces"].add(row["surface"]); item["episodes"].add(row["episode_id"]); item["count"] += 1
    summary = sorted(grouped.values(), key=lambda row: (-row["count"], -len(row["episodes"]), row["word"]))
    all_statuses["__unique__"] = len(unique_statuses)
    for status in STATUSES:
        all_statuses[f"__unique_{status}"] = sum(1 for value in unique_statuses.values() if value == status)
    return summary, occurrences, all_statuses
