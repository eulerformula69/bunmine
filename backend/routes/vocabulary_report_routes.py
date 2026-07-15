import tempfile
from io import BytesIO
from pathlib import Path
from flask import Blueprint, jsonify, request, send_file

from backend.api_response import error_response
from backend.services.job_service import get_job, start_job
from backend.services.vocabulary_report_service import VocabularyReportError, generate_vocabulary_report

vocabulary_report_bp = Blueprint("vocabulary-report", __name__)
_report_files = {}


@vocabulary_report_bp.post("/library/series/<int:series_id>/vocabulary-report")
def start_vocabulary_report(series_id):
    payload = request.get_json(silent=True) or {}
    try:
        # Validate cheap user errors before accepting a background job.
        if not payload.get("statuses"): raise VocabularyReportError("Select at least one status")
        if not any((payload.get("sheets") or {}).values()): raise VocabularyReportError("Select at least one sheet")
    except VocabularyReportError as error:
        return error_response(str(error), 400, "INVALID_REPORT_OPTIONS")

    def worker():
        stream, filename = generate_vocabulary_report(series_id, payload)
        target = Path(tempfile.gettempdir()) / f"bunmine-{filename}"
        target.write_bytes(stream.getvalue())
        return {"ok": True, "filename": filename, "path": str(target)}
    job = start_job("vocabulary-report", worker)
    return jsonify({"ok": True, "job": job}), 202


@vocabulary_report_bp.get("/library/vocabulary-report/<job_id>/download")
def download_vocabulary_report(job_id):
    job = get_job(job_id)
    if not job or job.get("kind") != "vocabulary-report": return error_response("Report not found", 404, "REPORT_NOT_FOUND")
    if job.get("status") != "completed": return error_response("Report is not ready", 409, "REPORT_NOT_READY")
    result = job.get("result") or {}; path = Path(result.get("path") or "")
    if not path.is_file(): return error_response("Report expired", 410, "REPORT_EXPIRED")
    content = path.read_bytes()
    path.unlink(missing_ok=True)
    return send_file(BytesIO(content), as_attachment=True, download_name=result.get("filename"), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
