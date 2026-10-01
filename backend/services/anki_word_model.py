from datetime import datetime, timedelta, UTC
from backend.text_processing import strip_html

STATUS_PRIORITY = {
    "mature": 5,
    "young": 4,
    "learning": 3,
    "new": 2,
    "suspended": 1,
    "unknown": 0,
}


def _utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_utc_iso(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _settings_refresh_anchor(settings: dict):
    return _parse_utc_iso(settings.get("lastAutoRefreshAt"))


def _is_auto_refresh_stale(settings: dict) -> bool:
    mode = str(settings.get("autoRefresh") or "off").strip().lower()
    if mode == "off":
        return False
    if mode not in {"daily", "weekly"}:
        return False

    # First startup after selecting daily/weekly should run once, because there is no saved anchor yet.
    anchor = _settings_refresh_anchor(settings)
    if anchor is None:
        return True

    interval = timedelta(days=7 if mode == "weekly" else 1)
    now = datetime.now(UTC)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    return now - anchor >= interval


def _normalize_highlight_word(value) -> str:
    # Keep this intentionally close to the browser normalizer: remove HTML-ish field markup,
    # collapse whitespace, and keep the actual Japanese spelling unchanged.
    text = strip_html(value, replacement=" ", decode_entities=False)
    return " ".join(text.split()).strip()


def _pick_better_status(old_status, new_status):
    old_status = str(old_status or "")
    new_status = str(new_status or "unknown")
    return new_status if STATUS_PRIORITY.get(new_status, 0) > STATUS_PRIORITY.get(old_status, 0) else old_status


def _card_status(card: dict) -> str:
    if card.get("queue") == -1:
        return "suspended"
    if card.get("type") == 0:
        return "new"
    if card.get("type") == 1 or card.get("queue") in {1, 3}:
        return "learning"

    interval = card.get("interval", card.get("ivl", 0))
    try:
        interval = float(interval or 0)
    except (TypeError, ValueError):
        interval = 0

    return "mature" if interval >= 21 else "young"
