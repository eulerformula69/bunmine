import json
import urllib.error
import urllib.request
from collections.abc import Callable, Iterator


def chunked(items: list, size: int) -> Iterator[list]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


def request(anki_url: str, action: str, params: dict | None = None):
    body = json.dumps({"action": action, "version": 6, "params": params or {}}).encode("utf-8")
    http_request = urllib.request.Request(anki_url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(http_request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
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
