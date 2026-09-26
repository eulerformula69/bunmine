import shutil
import subprocess

import pytest
from PIL import Image, ImageChops

from backend.services import media_export_service
from backend.services.image_subtitle_service import clip_subtitle_cues, screenshot_subtitle_text
from tests.test_media_export_service import make_settings


def payload():
    return {"imageSubtitleMode": "timed", "text": "First Second",
            "imageSubtitleCues": [{"start": 10, "end": 11, "text": "First"},
                                  {"start": 12, "end": 14, "text": "Second"}]}


def test_still_frame_uses_active_cues_and_preserves_gaps():
    data = payload()
    assert screenshot_subtitle_text(data, 10.5) == "First"
    assert screenshot_subtitle_text(data, 11) == ""
    assert screenshot_subtitle_text(data, 12) == "Second"
    assert screenshot_subtitle_text(data, 14) == ""
    data["imageSubtitleCues"].append({"start": 12, "end": 13, "text": "Overlap"})
    assert screenshot_subtitle_text(data, 12.5) == "Second Overlap"
    assert screenshot_subtitle_text({"text": "First Second"}, 11) == "First Second"
    assert screenshot_subtitle_text({"imageSubtitleMode": "timed"}, 11) == ""


def test_clip_times_are_relative_and_trimmed():
    assert clip_subtitle_cues(payload(), 10.5, 3) == [
        {"start": 0, "end": 0.5, "text": "First"},
        {"start": 1.5, "end": 3, "text": "Second"},
    ]
    assert clip_subtitle_cues(payload(), 14, 8) == []
    assert clip_subtitle_cues({"text": "First Second"}, 10, 8) == [
        {"start": 0, "end": 8, "text": "First Second"}]


@pytest.mark.parametrize("cue", [None, {"start": 0, "end": float("nan"), "text": "x"},
                                      {"start": 1, "end": 0, "text": "x"}])
def test_invalid_cue_is_rejected(cue):
    with pytest.raises(ValueError):
        clip_subtitle_cues({"imageSubtitleMode": "timed", "imageSubtitleCues": [cue]}, 0, 8)


def test_webp_cache_depends_on_subtitle_timing(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    (settings.video_dir / "clip.mkv").write_bytes(b"video")
    keys = []
    monkeypatch.setattr(media_export_service, "get_cached_media", lambda kind, key: keys.append(key) or "cached.webp")
    data = {**payload(), "filename": "clip.mkv", "start": 10, "end": 14}
    media_export_service.create_animated_webp(settings, data)
    data["imageSubtitleCues"][0]["end"] = 11.5
    media_export_service.create_animated_webp(settings, data)
    media_export_service.create_animated_webp(settings, {**data, "imageSubtitleMode": "all"})
    assert len(set(keys)) == 3


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg is required")
def test_real_webp_and_screenshots_follow_subtitle_times(monkeypatch, tmp_path):
    settings = make_settings(tmp_path)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                    "color=c=black:s=480x270:r=10:d=15", "-c:v", "libx264",
                    str(settings.video_dir / "clip.mkv")], check=True, capture_output=True)
    monkeypatch.setattr(media_export_service, "get_cached_media", lambda *args: None)
    monkeypatch.setattr(media_export_service, "save_cached_media", lambda *args: None)
    data = {**payload(), "filename": "clip.mkv", "start": 10, "end": 14, "fontSize": 24}
    result = media_export_service.create_animated_webp(settings, data)
    frames = {}
    with Image.open(settings.screenshot_dir / result["filename"]) as animation:
        for index in range(animation.n_frames):
            animation.seek(index)
            frame = animation.convert("RGB")
            frames[animation.info["timestamp"]] = frame.copy()
    def at(milliseconds):
        return frames[max(time for time in frames if time <= milliseconds)]
    assert at(500).getextrema()[0][1] > 100
    assert at(1500).getextrema()[0][1] < 10
    assert at(2500).getextrema()[0][1] > 100
    assert ImageChops.difference(at(500), at(2500)).getbbox()
    for time, visible in [(10.5, True), (11.5, False), (12.5, True)]:
        result = media_export_service.create_screenshot(settings, {**data, "time": time})
        with Image.open(settings.screenshot_dir / result["filename"]) as frame:
            assert (frame.getextrema()[0][1] > 100) == visible
    assert not list(settings.video_dir.glob("temp_*.ass"))
