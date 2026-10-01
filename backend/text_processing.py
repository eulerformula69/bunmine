"""HTML field cleanup with explicit whitespace and entity rules."""

import html
import re


def strip_html(value, *, replacement="", decode_entities=True, preserve_newlines=False):
    """Remove tags with the caller's existing text rules.

    Vocabulary reports replace block tags before this call and decode entities.
    Dedupe preserves newlines, so a tag match cannot span subtitle lines.
    Anki word fields replace tags with spaces and keep entities encoded.
    """
    pattern = r"</?[^>\n]+>" if preserve_newlines else r"<[^>]+>"
    text = re.sub(pattern, replacement, str(value or ""))
    return html.unescape(text) if decode_entities else text
