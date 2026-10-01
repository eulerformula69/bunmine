from pathlib import Path

from backend.repositories.playback_repository import get_library_file_by_id
from backend.settings import Settings
from backend.utils_validation import is_within, safe_media_name


def resolve_media_file(file_id: int, settings: Settings) -> tuple[Path | None, dict | None, tuple | None]:
    result = get_library_file_by_id(settings.library_db_path, file_id)
    if not result.get("found"):
        return None, None, ({"error": "File not found"}, 404)
    info = result["file"]
    path = Path(info["path"]).resolve()
    if not is_within(settings.media_library_dir, path):
        return None, info, ({"error": "File is outside MEDIA_LIBRARY_DIR"}, 403)
    if not path.is_file():
        return None, info, ({"error": "File is missing"}, 404)
    return path, info, None


def resolve_video_path_from_payload(
    data: dict,
    settings: Settings,
) -> tuple[Path | None, dict | None, tuple | None]:
    if not isinstance(data, dict):
        return None, None, ({"error": "Invalid JSON payload"}, 400)

    video_file_id = data.get("videoFileId")

    if video_file_id is not None:
        try:
            file_id = int(video_file_id)
        except (TypeError, ValueError):
            return None, None, ({"error": "Invalid videoFileId"}, 400)

        video_path, file_info, error = resolve_media_file(file_id, settings)
        if file_info is None:
            return None, None, ({"error": "Library video file not found"}, 404)

        if file_info.get("file_type") != "video":
            return None, None, ({"error": "Library file is not a video"}, 400)

        if error:
            message = "Video file is outside MEDIA_LIBRARY_DIR" if error[1] == 403 else "Video file is missing"
            return None, None, ({"error": message}, error[1])

        return (
            video_path,
            {
                "source": "library",
                "videoFileId": file_id,
                "path": str(video_path),
            },
            None,
        )

    filename = data.get("filename")
    if not filename:
        return None, None, ({"error": "filename or videoFileId is required"}, 400)

    try:
        safe_filename = safe_media_name(filename)
    except ValueError as err:
        return None, None, ({"error": str(err)}, 400)

    video_path = (settings.video_dir / safe_filename).resolve()
    if not is_within(settings.video_dir, video_path):
        return None, None, ({"error": "Video file is outside VIDEO_DIR"}, 403)
    if not video_path.exists() or not video_path.is_file():
        return None, None, ({"error": "Video file not found"}, 404)

    return (
        video_path,
        {
            "source": "uploaded",
            "filename": safe_filename,
            "path": str(video_path),
        },
        None,
    )
