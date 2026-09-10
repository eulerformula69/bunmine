import json
import logging
import urllib.error
import urllib.parse
import urllib.request


logger = logging.getLogger(__name__)


def search_kitsu_covers(query: str) -> list[dict]:
    params = urllib.parse.urlencode({"filter[text]": query, "page[limit]": 8})
    request = urllib.request.Request(
        f"https://kitsu.io/api/edge/anime?{params}",
        headers={"Accept": "application/vnd.api+json", "User-Agent": "Bunmine/1.0"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        data = json.load(response)
    if not isinstance(data.get("data"), list):
        raise ValueError("Kitsu returned an invalid search response")
    results = []
    for item in data["data"]:
        attributes = item.get("attributes") or {}
        poster = attributes.get("posterImage") or {}
        cover_url = poster.get("large") or poster.get("original") or poster.get("medium")
        if not cover_url:
            continue
        titles = attributes.get("titles") or {}
        results.append({
            "source": "kitsu",
            "externalId": item["id"],
            "title": titles.get("en_jp") or attributes.get("canonicalTitle") or "",
            "englishTitle": titles.get("en") or titles.get("en_us"),
            "nativeTitle": titles.get("ja_jp"),
            "preferredTitle": attributes.get("canonicalTitle"),
            "coverUrl": cover_url,
            "siteUrl": f"https://kitsu.app/anime/{item['id']}",
            "format": attributes.get("subtype"),
            "seasonYear": (attributes.get("startDate") or "")[:4] or None,
            "episodes": attributes.get("episodeCount"),
        })
    return results


def search_covers(query: str) -> list[dict]:
    query = str(query or "").strip()
    if not query:
        return []
    failures = 0
    for name, search in (("AniList", search_anilist_covers), ("Kitsu", search_kitsu_covers)):
        try:
            results = search(query)
            if results:
                return results
        except (OSError, ValueError, TypeError, KeyError, AttributeError):
            failures += 1
            logger.warning("Cover provider %s failed", name, exc_info=True)
    if failures:
        raise RuntimeError("Cover search is temporarily unavailable. Please try again later.")
    return []


ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

ANILIST_SEARCH_QUERY = """
query ($search: String!) {
  Page(page: 1, perPage: 8) {
    media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
        userPreferred
      }
      coverImage {
        large
        extraLarge
      }
      format
      seasonYear
      episodes
      siteUrl
    }
  }
}
"""


def _http_json_post(url: str, payload: dict, timeout: int = 12) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Bunmine/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def search_anilist_covers(query: str) -> list[dict]:
    query = str(query or "").strip()
    if not query:
        return []
    payload = {"query": ANILIST_SEARCH_QUERY, "variables": {"search": query}}
    data = _http_json_post(ANILIST_GRAPHQL_URL, payload)
    if data.get("errors") or not isinstance(data.get("data"), dict):
        raise ValueError("AniList returned an invalid search response")
    media_items = data["data"].get("Page", {}).get("media", [])

    results = []
    for item in media_items:
        title = item.get("title") or {}
        cover = item.get("coverImage") or {}
        cover_url = cover.get("extraLarge") or cover.get("large")
        if not cover_url:
            continue
        results.append({
            "source": "anilist",
            "externalId": item.get("id"),
            "title": title.get("romaji") or title.get("userPreferred") or title.get("english") or "",
            "englishTitle": title.get("english"),
            "nativeTitle": title.get("native"),
            "preferredTitle": title.get("userPreferred"),
            "coverUrl": cover_url,
            "siteUrl": item.get("siteUrl"),
            "format": item.get("format"),
            "seasonYear": item.get("seasonYear"),
            "episodes": item.get("episodes"),
        })
    return results


