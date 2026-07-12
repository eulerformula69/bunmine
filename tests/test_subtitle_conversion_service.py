import subprocess
from pathlib import Path

from backend.services import subtitle_conversion_service
from backend.services.subtitle_conversion_service import (
    convert_ass_to_srt,
    get_srt_playback_subtitle,
)


def test_convert_ass_to_srt_uses_temporary_output(monkeypatch, tmp_path: Path):
    source = tmp_path / "episode.ass"
    target = tmp_path / "episode.srt"
    source.write_text("[Events]", encoding="utf-8")
    calls = []

    def fake_run(command):
        calls.append(command)
        Path(command[-1]).write_text("1\n00:00:01,000 --> 00:00:02,000\ntext\n", encoding="utf-8")
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(subtitle_conversion_service, "run_subprocess", fake_run)

    assert convert_ass_to_srt(source, target) == target
    assert target.exists()
    assert calls[0][calls[0].index("-c:s") + 1] == "srt"
    assert not list(tmp_path.glob("*.tmp.srt"))


def test_library_conversion_reuses_cache(monkeypatch, tmp_path: Path):
    source = tmp_path / "episode.ass"
    source.write_text("[Events]", encoding="utf-8")
    cache_dir = tmp_path / "cache"
    calls = []

    def fake_convert(_source, target):
        calls.append(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("converted", encoding="utf-8")
        return target

    monkeypatch.setattr(subtitle_conversion_service, "convert_ass_to_srt", fake_convert)

    first = get_srt_playback_subtitle(source, cache_dir)
    second = get_srt_playback_subtitle(source, cache_dir)

    assert first == second
    assert first.suffix == ".srt"
    assert len(calls) == 1


def test_srt_library_file_is_served_without_conversion(tmp_path: Path):
    source = tmp_path / "episode.srt"
    source.write_text("subtitle", encoding="utf-8")

    assert get_srt_playback_subtitle(source, tmp_path / "cache") == source
