import threading
import uuid
import time
import logging
from datetime import datetime, UTC
from collections.abc import Callable


_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_finished_times: dict[str, float] = {}
JOB_TTL_SECONDS = 3600
MAX_JOBS = 200


def _prune_jobs(*, reserve: int = 0) -> None:
    now = time.monotonic()
    for job_id, finished in list(_finished_times.items()):
        if now - finished >= JOB_TTL_SECONDS:
            _jobs.pop(job_id, None)
            _finished_times.pop(job_id, None)
    for job_id in list(_finished_times):
        if len(_jobs) + reserve <= MAX_JOBS:
            break
        _jobs.pop(job_id, None)
        _finished_times.pop(job_id, None)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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
        _prune_jobs(reserve=1)
        if len(_jobs) >= MAX_JOBS:
            raise ValueError("Too many active jobs. Wait for a job to finish.")
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
                _finished_times[job_id] = time.monotonic()
        except Exception as err:
            logging.getLogger(__name__).error("Job %s failed", job_id, exc_info=(type(err), err, err.__traceback__))
            with _jobs_lock:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = f"Job failed. Reference: {job_id}"
                _jobs[job_id]["finishedAt"] = _now_iso()
                _finished_times[job_id] = time.monotonic()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return get_job(job_id)


def get_job(job_id: str) -> dict | None:
    with _jobs_lock:
        _prune_jobs()
        job = _jobs.get(job_id)
        return dict(job) if job else None
