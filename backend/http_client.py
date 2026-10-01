"""Bounded HTTP requests shared by external integrations."""

import json
import urllib.request


class ResponseTooLargeError(ValueError):
    """The response exceeded the configured byte limit."""


def _request(
    url, *, payload=None, headers=None, timeout=12, max_bytes=16 * 1024 * 1024, opener=None, content_type=None
):
    if max_bytes <= 0:
        raise ValueError("Response size limit must be positive")
    request_headers = {"User-Agent": "Bunmine/1.0", "Accept": "application/json", **(headers or {})}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        url, data=body, headers=request_headers, method="POST" if body is not None else "GET"
    )
    open_request = opener.open if opener is not None else urllib.request.urlopen
    with open_request(request, timeout=timeout) as response:
        if content_type and not response.headers.get("Content-Type", "").startswith(content_type):
            raise ValueError("Response has an unsupported content type")
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ResponseTooLargeError("Response exceeds the size limit")
    return data


def get_bytes(url, **options):
    return _request(url, **options)


def get_json(url, **options):
    return json.loads(get_bytes(url, **options).decode("utf-8"))


def post_json(url, payload, **options):
    return json.loads(_request(url, payload=payload, **options).decode("utf-8"))
