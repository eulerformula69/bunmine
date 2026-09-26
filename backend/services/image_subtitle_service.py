import math
import textwrap


def image_subtitle_cues(data):
    """Read subtitle times in the source video's timeline."""
    mode = data.get("imageSubtitleMode", "all")
    if mode not in ("all", "timed"):
        raise ValueError("Invalid image subtitle mode")
    if mode == "all":
        return None
    cues = data.get("imageSubtitleCues", [])
    if not isinstance(cues, list) or len(cues) > 50000:
        raise ValueError("Invalid image subtitles")
    result = []
    for cue in cues:
        if not isinstance(cue, dict) or not isinstance(cue.get("text"), str):
            raise ValueError("Invalid image subtitle text")
        for key in ("start", "end"):
            value = cue.get(key)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError("Invalid image subtitle time")
        if cue["end"] <= cue["start"]:
            raise ValueError("Invalid image subtitle interval")
        result.append({"start": cue["start"], "end": cue["end"], "text": cue["text"].strip()})
    return result


def screenshot_subtitle_text(data, time):
    cues = image_subtitle_cues(data)
    if cues is None:
        return data.get("text", "").strip()
    return " ".join(cue["text"] for cue in cues if cue["start"] <= time < cue["end"])


def clip_subtitle_cues(data, start, duration):
    cues = image_subtitle_cues(data)
    if cues is None:
        return [{"start": 0, "end": duration, "text": data.get("text", "").strip()}]
    return [
        {"start": max(0, cue["start"] - start),
         "end": min(duration, cue["end"] - start), "text": cue["text"]}
        for cue in cues
        if cue["text"] and cue["start"] < start + duration and cue["end"] > start
    ]


def ass_timestamp(seconds):
    centiseconds = round(seconds * 100)
    minutes, remainder = divmod(centiseconds, 6000)
    hours, minutes = divmod(minutes, 60)
    seconds, fraction = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{seconds:02d}.{fraction:02d}"


def subtitle_ass(cues, font_size):
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans JP,{font_size},&H00FFFFFF,&H00000000,1,12,0,2,40,40,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in cues:
        text = "\n".join(textwrap.wrap(cue["text"], width=15))
        text = text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")
        events.append(f"Dialogue: 0,{ass_timestamp(cue['start'])},{ass_timestamp(cue['end'])},Default,,0,0,0,,{text}\n")
    return header + "".join(events)
