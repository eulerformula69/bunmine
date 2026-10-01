import urllib.error
import urllib.request
from collections.abc import Callable, Iterator
from backend.http_client import post_json


def chunked(items: list, size: int) -> Iterator[list]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def request(anki_url: str, action: str, params: dict | None = None):
    try:
        data = post_json(anki_url, {"action": action, "version": 6, "params": params or {}}, timeout=60)
    except urllib.error.URLError as err:
        reason = getattr(err, "reason", err)
        raise RuntimeError(
            f"Cannot reach AnkiConnect at {anki_url}. Make sure Anki is open and "
            f"AnkiConnect is installed. Details: {reason}"
        ) from err
    except TimeoutError as err:
        raise RuntimeError(f"AnkiConnect request timed out while running {action}.") from err
    if data.get("error"):
        raise RuntimeError(f"AnkiConnect {action} failed: {data['error']}")
    return data.get("result")


def build_deck_query(deck_names: list[str]) -> str:
    def escape(value: str) -> str:
        return str(value or "").replace("\\", "\\\\").replace('"', '\\"')

    return " OR ".join(f'deck:"{escape(deck)}"' for deck in deck_names if deck)


def extract_words_from_note(note: dict, word_fields: list[str], normalize: Callable[[object], str]) -> list[str]:
    fields = note.get("fields") if isinstance(note.get("fields"), dict) else {}
    words: list[str] = []
    seen: set[str] = set()
    for field_name in word_fields:
        field = fields.get(field_name) if isinstance(fields.get(field_name), dict) else {}
        word = normalize(field.get("value"))
        if word and word not in seen:
            seen.add(word)
            words.append(word)
    return words


def note_card_ids(note: dict) -> list[int]:
    result: list[int] = []
    for raw_card_id in note.get("cards") if isinstance(note.get("cards"), list) else []:
        try:
            result.append(int(raw_card_id))
        except (TypeError, ValueError):
            continue
    return result
