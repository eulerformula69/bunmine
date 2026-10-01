"""HTML field cleanup with explicit whitespace and entity rules."""

import html
import re


def strip_html(value, *, replacement="", decode_entities=True, preserve_newlines=False):
    pattern = r"</?[^>\n]+>" if preserve_newlines else r"<[^>]+>"
    text = re.sub(pattern, replacement, str(value or ""))
    return html.unescape(text) if decode_entities else text
