import subprocess


def make_friendly_ffmpeg_error(details: str) -> str:
    raw = str(details or "").strip()
    lower = raw.lower()

    if "no such file or directory" in lower:
        return "Media file or FFmpeg input file was not found. Check that the video/subtitle path still exists."
    if "stream map" in lower or "matches no streams" in lower or "stream specifier" in lower:
        return "Selected audio track was not found in this video. Try another audio track in settings."
    if "invalid data found" in lower or "could not find codec parameters" in lower:
        return "FFmpeg could not read this media file. The file may be damaged or use an unsupported format."
    if "permission denied" in lower:
        return "FFmpeg could not write the output file. Check permissions for the Anki media folder."
    if "error initializing filter" in lower or ("subtitles" in lower and "error" in lower):
        return "FFmpeg could not render subtitles into the image. Check the subtitle text and font files."

    if not raw:
        return "FFmpeg failed without a detailed error message."
    return raw[-1200:]


def run_subprocess(cmd: list[str]) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        raise RuntimeError("FFmpeg/FFprobe is not installed or not available in PATH.")
    except subprocess.CalledProcessError as err:
        details = err.stderr.strip() if err.stderr else str(err)
        raise RuntimeError(make_friendly_ffmpeg_error(details))


