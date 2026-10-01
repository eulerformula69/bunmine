import math

from backend.repositories import candidate_repository as repository
from backend.services.video_service import resolve_video_path_from_payload


def source_details(settings, snapshot):
    path, info, error = resolve_video_path_from_payload(snapshot.get("videoPayload"), settings)
    if error:
        raise ValueError(error[0]["error"])
    stat = path.stat()
    identity = f"{stat.st_size}:{stat.st_mtime_ns}"
    episode_id = None
    if info["source"] == "library":
        from backend.repositories.playback_repository import get_library_file_by_id

        episode_id = get_library_file_by_id(settings.library_db_path, info["videoFileId"])["file"]["episode_id"]
    return identity, episode_id


def capture_candidate(settings, snapshot):
    if not isinstance(snapshot, dict):
        raise ValueError("A media snapshot is required")
    for key in ("selectedWord", "combinedText"):
        if not isinstance(snapshot.get(key), str) or not snapshot[key].strip():
            raise ValueError(f"{key} is required")
    for key in ("targetTime", "audioStart", "audioEnd", "currentIdx", "volumeLevel"):
        value = snapshot.get(key)
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
            raise ValueError(f"Invalid {key}")
    if snapshot["audioEnd"] <= snapshot["audioStart"] or int(snapshot["currentIdx"]) != snapshot["currentIdx"]:
        raise ValueError("Invalid subtitle timing")
    for key in (
        "screenshotMode",
        "imageSubtitleText",
        "fontSize",
        "trackIndex",
        "ankiUrl",
        "deckName",
        "pictureField",
        "audioField",
        "sentenceField",
    ):
        if not isinstance(snapshot.get(key), str):
            raise ValueError(f"Invalid {key}")
    from backend.services.candidate_context_service import finite_number
    from backend.services.image_subtitle_service import image_subtitle_cues

    if not finite_number(snapshot.get("imageSubtitleDelay", 0)):
        raise ValueError("Invalid image subtitle delay")
    image_subtitle_cues(snapshot)
    if "context" in snapshot:
        from backend.services.candidate_context_service import validate_context

        validate_context(snapshot["context"], snapshot)
    identity, episode_id = source_details(settings, snapshot)
    return repository.create_candidate(settings.library_db_path, snapshot, identity, episode_id)


def check_source(settings, candidate_id):
    candidate = repository.get_candidate(settings.library_db_path, candidate_id)
    identity, _ = source_details(settings, candidate["snapshot"])
    if identity != candidate["source_identity"]:
        raise ValueError("The source video changed. Restore the original file before review.")
    return candidate
