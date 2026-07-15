import json
import re
import subprocess
from datetime import date
from pathlib import Path

from backend.config import LIBRARY_DB_PATH, PROJECT_DIR
from backend.library_db import get_db
from backend.services.anki_highlight_store import read_anki_highlight_settings, read_known_anki_data, read_words_file, known_basic_words_path
from backend.services.vocabulary_report_model import STATUSES, build_report_rows, pick_sentence
from backend.services.vocabulary_report_workbook import create_workbook


class VocabularyReportError(ValueError):
    pass


def safe_report_filename(title: str) -> str:
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", title).strip(" ._") or "series"
    return f"{safe[:100]}_vocabulary_report_{date.today().isoformat()}.xlsx"


def _series_files(series_id: int):
    with get_db(LIBRARY_DB_PATH) as conn:
        series = conn.execute("SELECT id, title FROM series WHERE id=?", (series_id,)).fetchone()
        if not series: raise VocabularyReportError("Series not found")
        episodes = conn.execute("""SELECT e.id, e.title, e.episode_number, lf.path FROM episodes e
            LEFT JOIN library_files lf ON lf.id=(SELECT id FROM library_files WHERE episode_id=e.id AND file_type='subtitle' AND file_exists=1 ORDER BY is_primary DESC,id LIMIT 1)
            WHERE e.series_id=? ORDER BY COALESCE(e.season_number,1), e.episode_number, e.id""", (series_id,)).fetchall()
    if not episodes: raise VocabularyReportError("Series has no episodes")
    files = [{"episodeId": row["id"], "episode": row["title"] or f"Episode {row['episode_number']}", "path": row["path"]} for row in episodes if row["path"] and Path(row["path"]).is_file()]
    if not files: raise VocabularyReportError("Series has no available subtitles")
    return dict(series), files


def generate_vocabulary_report(series_id: int, payload: dict):
    statuses = set(payload.get("statuses") or [])
    sheets = payload.get("sheets") if isinstance(payload.get("sheets"), dict) else {}
    if not statuses or not statuses <= STATUSES: raise VocabularyReportError("Select at least one valid status")
    if not any(sheets.get(name) for name in ("summary", "occurrences", "statistics")): raise VocabularyReportError("Select at least one sheet")
    series, files = _series_files(series_id)
    process = subprocess.run(
        ["node", "tools/vocabulary-analyzer.mjs"],
        input=json.dumps({"files": files}, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        errors="strict",
        capture_output=True,
        cwd=PROJECT_DIR,
        timeout=600,
    )
    if process.returncode: raise VocabularyReportError(f"Could not analyze subtitles: {process.stderr.strip()}")
    if not process.stdout:
        raise VocabularyReportError("Subtitle analyzer returned no data")
    try:
        cues = json.loads(process.stdout)
    except json.JSONDecodeError as error:
        raise VocabularyReportError("Subtitle analyzer returned invalid data") from error
    cache = read_known_anki_data(); known = cache.get("words", {})
    settings = read_anki_highlight_settings(); sentence_fields = settings.get("sentenceFields") or ["Sentence", "Example", "ExpressionSentence", "Context"]
    for info in known.values():
        if isinstance(info, dict) and not info.get("sentence"): info["sentence"] = pick_sentence(info.get("fields", {}), sentence_fields)
    known_basic = set(read_words_file(known_basic_words_path()))
    summary, occurrences, totals = build_report_rows(
        series["title"], cues, known, known_basic, statuses,
        include_particles=bool(payload.get("includeParticles")),
    )
    return create_workbook(summary, occurrences, totals, sheets), safe_report_filename(series["title"])
