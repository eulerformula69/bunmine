import time

from backend.ffmpeg_service import make_friendly_ffmpeg_error
from backend.services.job_service import get_job, start_job


def test_make_friendly_ffmpeg_error_for_missing_audio_track():
    message = make_friendly_ffmpeg_error("Stream map '0:a:9' matches no streams.")

    assert "audio track" in message.lower()
    assert "try another" in message.lower()


def test_start_job_completes_successfully():
    job = start_job("unit-test", lambda: {"ok": True, "value": 42})

    for _ in range(20):
        current = get_job(job["id"])
        if current["status"] == "completed":
            break
        time.sleep(0.05)

    assert current["status"] == "completed"
    assert current["result"]["value"] == 42

