import subprocess

import pytest

from backend import ffmpeg_service


def test_run_subprocess_reports_timeout(monkeypatch):
    def time_out(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], kwargs["timeout"])

    monkeypatch.setattr(ffmpeg_service.subprocess, "run", time_out)

    with pytest.raises(RuntimeError, match="timed out after 12 seconds"):
        ffmpeg_service.run_subprocess(["ffmpeg", "-version"], timeout_seconds=12)
