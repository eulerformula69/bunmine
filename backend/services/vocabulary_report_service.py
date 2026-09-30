import json
import re
import subprocess
from datetime import date
from pathlib import Path

from backend.repositories.connection import get_db
from backend.services.anki_highlight_store import read_anki_highlight_settings, read_known_anki_data, read_words_file, known_basic_words_path
from backend.services.vocabulary_report_model import STATUSES, build_report_rows, pick_sentence
from backend.services.vocabulary_report_workbook import create_workbook
from backend.settings import Settings


class VocabularyReportError(ValueError):
    pass


def safe_report_filename(title: str) -> str:
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", title).strip(" ._") or "series"
    return f"{safe[:100]}_vocabulary_report_{date.today().isoformat()}.xlsx"


def _series_files(settings: Settings, series_id: int):
    with get_db(settings.library_db_path) as conn:
        series = conn.execute("SELECT id, title FROM series WHERE id=?", (series_id,)).fetchone()
        if not series: raise VocabularyReportError("Series not found")
        episodes = conn.execute("""SELECT e.id, e.title, e.episode_number, lf.path FROM episodes e
            LEFT JOIN library_files lf ON lf.id=(SELECT id FROM library_files WHERE episode_id=e.id AND file_type='subtitle' AND file_exists=1 ORDER BY is_primary DESC,id LIMIT 1)
            WHERE e.series_id=? ORDER BY COALESCE(e.season_number,1), e.episode_number, e.id""", (series_id,)).fetchall()
    if not episodes: raise VocabularyReportError("Series has no episodes")
    files = [{"episodeId": row["id"], "episode": row["title"] or f"Episode {row['episode_number']}", "path": row["path"]} for row in episodes if row["path"] and Path(row["path"]).is_file()]
    if not files: raise VocabularyReportError("Series has no available subtitles")
    return dict(series), files


def generate_vocabulary_report(settings: Settings, series_id: int, payload: dict):
    statuses = set(payload.get("statuses") or [])
    sheets = payload.get("sheets") if isinstance(payload.get("sheets"), dict) else {}
    if not statuses or not statuses <= STATUSES: raise VocabularyReportError("Select at least one valid status")
    if not any(sheets.get(name) for name in ("summary", "occurrences", "statistics")): raise VocabularyReportError("Select at least one sheet")
    series, files = _series_files(settings, series_id)
    process = subprocess.run(
        ["node", "tools/vocabulary-analyzer.mjs"],
        input=json.dumps({"files": files}, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        errors="strict",
        capture_output=True,
        cwd=settings.project_dir,
        timeout=600,
    )
    if process.returncode: raise VocabularyReportError(f"Could not analyze subtitles: {process.stderr.strip()}")
    if not process.stdout:
        raise VocabularyReportError("Subtitle analyzer returned no data")
    try:
        cues = json.loads(process.stdout)
    except json.JSONDecodeError as error:
        raise VocabularyReportError("Subtitle analyzer returned invalid data") from error
    cache = read_known_anki_data(settings); known = cache.get("words", {})
    highlight_settings = read_anki_highlight_settings(settings); sentence_fields = highlight_settings.get("sentenceFields") or ["Sentence", "Example", "ExpressionSentence", "Context"]
    for info in known.values():
        if isinstance(info, dict) and not info.get("sentence"): info["sentence"] = pick_sentence(info.get("fields", {}), sentence_fields)
    known_basic = set(read_words_file(known_basic_words_path(settings)))
    summary, occurrences, totals = build_report_rows(
        series["title"], cues, known, known_basic, statuses,
        include_particles=bool(payload.get("includeParticles")),
        include_auxiliary_forms=bool(payload.get("includeAuxiliaryForms")),
    )
    return create_workbook(summary, occurrences, totals, sheets), safe_report_filename(series["title"])
