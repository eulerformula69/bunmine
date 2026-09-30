import ipaddress
import re
import socket
import urllib.parse
import urllib.request
from pathlib import Path

from backend.repositories.connection import get_db
from backend.utils_validation import is_within


def _validate_cover_url(cover_url: str, allowed_hosts: frozenset[str]) -> str:
    parsed = urllib.parse.urlparse(cover_url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not hostname or hostname not in allowed_hosts:
        raise ValueError("Cover URL must use HTTPS and an allowed host")

    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise ValueError("Cover host could not be resolved") from error
    if not addresses:
        raise ValueError("Cover host could not be resolved")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
            raise ValueError("Cover host resolved to a non-public address")
    return hostname


class _ValidatedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: frozenset[str]):
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_cover_url(newurl, self.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _safe_cover_name(value: str) -> str:
    value = str(value or "")
    value = re.sub(r"[^a-zA-Z0-9_.-]+", "_", value).strip("._-")
    return value or "cover"


def _extension_from_url(url: str) -> str:
    lower = url.lower().split("?", 1)[0]
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        if lower.endswith(ext):
            return ext
    return ".jpg"


def download_cover_file(
    covers_dir: Path,
    series_id: int,
    source: str,
    external_id: str | int,
    cover_url: str,
    allowed_hosts: frozenset[str],
    max_bytes: int,
) -> Path:
    _validate_cover_url(cover_url, allowed_hosts)
    covers_dir.mkdir(parents=True, exist_ok=True)
    filename = f"series_{series_id}_{_safe_cover_name(source)}_{_safe_cover_name(str(external_id))}{_extension_from_url(cover_url)}"
    target_path = covers_dir / filename

    request = urllib.request.Request(
        cover_url,
        headers={
            "User-Agent": "Bunmine/1.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        method="GET",
    )
    opener = urllib.request.build_opener(_ValidatedRedirectHandler(allowed_hosts))
    with opener.open(request, timeout=20) as response:
        content_type = response.headers.get("Content-Type", "")
        data = response.read(max_bytes + 1)

    if not content_type.startswith("image/"):
        raise ValueError(f"Cover URL did not return an image: {content_type}")
    if not data:
        raise ValueError("Downloaded cover is empty")
    if len(data) > max_bytes:
        raise ValueError("Downloaded cover exceeds the size limit")
    target_path.write_bytes(data)
    return target_path.resolve()


def save_series_cover(
    db_path: Path,
    covers_dir: Path,
    series_id: int,
    source: str,
    external_id: str | int,
    cover_url: str,
    allowed_hosts: frozenset[str],
    max_bytes: int,
) -> dict:
    cover_path = download_cover_file(
        covers_dir,
        series_id,
        source,
        external_id,
        cover_url,
        allowed_hosts,
        max_bytes,
    )
    relative_path = str(cover_path.relative_to(covers_dir.parent.parent))
    with get_db(db_path) as conn:
        series = conn.execute("SELECT id FROM series WHERE id = ?", (series_id,)).fetchone()
        if not series:
            return {"found": False, "coverFileId": None}
        row = conn.execute("SELECT id FROM library_files WHERE path = ?", (str(cover_path),)).fetchone()

        if row:
            cover_file_id = int(row["id"])
            conn.execute(
                """
                UPDATE library_files
                SET series_id = ?, episode_id = NULL, file_type = 'cover', relative_path = ?, file_exists = 1,
                    is_primary = 1, missing_since = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (series_id, relative_path, cover_file_id),
            )
        else:
            cur = conn.execute(
                """
                INSERT INTO library_files(series_id, episode_id, file_type, path, relative_path, file_exists, is_primary, linked_at)
                VALUES(?, NULL, 'cover', ?, ?, 1, 1, CURRENT_TIMESTAMP)
                """,
                (series_id, str(cover_path), relative_path),
            )
            cover_file_id = int(cur.lastrowid)

        conn.execute(
            "UPDATE series SET cover_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (cover_file_id, series_id),
        )

    return {"found": True, "coverFileId": cover_file_id, "coverPath": str(cover_path)}


def get_series_cover_file(db_path: Path, series_id: int) -> dict:
    with get_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT lf.id, lf.path, lf.relative_path, lf.file_exists
            FROM series s
            JOIN library_files lf ON lf.id = s.cover_file_id
            WHERE s.id = ? AND lf.file_type = 'cover'
            """,
            (series_id,),
        ).fetchone()
        if not row:
            return {"found": False, "file": None}
        return {"found": True, "file": dict(row)}

def resolve_cover_file_path(covers_dir: Path, file_info: dict) -> Path | None:
    """Resolve both current and legacy cover DB records to a safe path under LibraryCovers."""
    candidates: list[Path] = []

    stored_path = file_info.get("path") if file_info else None
    relative_path = file_info.get("relative_path") if file_info else None

    if stored_path:
        candidates.append(Path(stored_path).expanduser().resolve())
        candidates.append((covers_dir / Path(stored_path).name).resolve())

    if relative_path:
        rel = Path(str(relative_path))
        candidates.append((covers_dir / rel.name).resolve())
        # Old versions stored paths relative to BASE_DIR, e.g. frontend/LibraryCovers/file.jpg.
        if len(rel.parts) >= 1:
            candidates.append((covers_dir.parent.parent / rel).resolve())

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if not is_within(covers_dir, candidate):
            continue
        if candidate.exists() and candidate.is_file():
            return candidate
    return None
