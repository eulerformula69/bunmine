from __future__ import annotations

import html
import re
import unicodedata
from collections import Counter

STATUSES = {"not_in_anki", "new", "learning", "young", "mature", "suspended", "known_basic"}
PARTICLE_LIKE_FORMS = {
    "は", "が", "を", "に", "へ", "と", "で", "も", "の", "ん", "から", "まで", "より",
    "や", "か", "ね", "よ", "な", "ぞ", "ぜ", "さ", "わ", "って", "ったら", "けど", "けれど",
    "ので", "のに", "とか", "という", "なんて", "しか", "だけ", "ほど", "くらい", "ぐらい",
    "ばかり", "でも", "ても",
}
AUXILIARY_LIKE_FORMS = {
    "だ", "た", "ない", "ます", "う", "れる", "さん", "どう", "まし", "あっ", "お", "たい", "っす", "なん",
    "じゃん", "もの", "あ", "たち", "ぬ", "ら", "く", "ちゃう", "うい", "られる", "おお",
    "ええ", "たく", "がる", "おっ", "ご", "しまう", "す", "では", "はっ", "ほら", "り",
    "ま", "おい",
}


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


def is_non_lexical_token(
    token: dict,
    include_particles: bool = False,
    include_auxiliary_forms: bool = False,
) -> bool:
    surface = str(token.get("surface") or "").strip()
    pos = str(token.get("pos") or "")
    pos_detail = str(token.get("posDetail") or "")
    if not surface or pos in {"記号", "フィラー"}:
        return True
    if not include_particles and (pos == "助詞" or surface in PARTICLE_LIKE_FORMS):
        return True
    if not include_auxiliary_forms and (pos == "助動詞" or surface in AUXILIARY_LIKE_FORMS):
        return True
    if pos_detail == "数" or all(character.isnumeric() for character in surface):
        return True
    return all(unicodedata.category(character)[0] in {"P", "S", "Z", "C"} for character in surface)


def build_report_rows(
    series: str,
    cues: list[dict],
    known: dict,
    known_basic: set[str],
    statuses: set[str],
    include_particles: bool = False,
    include_auxiliary_forms: bool = False,
):
    occurrences, all_statuses, unique_statuses = [], Counter(), {}
    for cue in cues:
        seen_positions = set()
        for token in cue.get("tokens", []):
            surface = str(token.get("surface") or "").strip()
            if is_non_lexical_token(token, include_particles, include_auxiliary_forms):
                continue
            position_key = (cue.get("episodeId"), cue.get("start"), token.get("position"))
            if position_key in seen_positions:
                continue
            seen_positions.add(position_key)
            word, info, match_type = _match(token, known, known_basic)
            if not include_particles and word in PARTICLE_LIKE_FORMS:
                continue
            if not include_auxiliary_forms and word in AUXILIARY_LIKE_FORMS:
                continue
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
