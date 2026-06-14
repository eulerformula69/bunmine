import threading
import uuid
from datetime import datetime, timezone
from typing import Callable


_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def start_job(kind: str, worker: Callable[[], dict]) -> dict:
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "kind": kind,
        "status": "queued",
        "createdAt": _now_iso(),
        "startedAt": None,
        "finishedAt": None,
        "result": None,
        "error": None,
    }

    with _jobs_lock:
        _jobs[job_id] = job

    def run() -> None:
        with _jobs_lock:
            _jobs[job_id]["status"] = "running"
            _jobs[job_id]["startedAt"] = _now_iso()

        try:
            result = worker()
            with _jobs_lock:
                _jobs[job_id]["status"] = "completed" if result.get("ok", True) else "failed"
                _jobs[job_id]["result"] = result
                _jobs[job_id]["error"] = result.get("error")
                _jobs[job_id]["finishedAt"] = _now_iso()
        except Exception as err:
            with _jobs_lock:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = str(err)
                _jobs[job_id]["finishedAt"] = _now_iso()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return get_job(job_id)


def get_job(job_id: str) -> dict | None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
