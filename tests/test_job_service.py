from backend.services import job_service as jobs


def test_completed_jobs_expire_but_running_jobs_remain(monkeypatch):
    monkeypatch.setattr(jobs, "_jobs", {"old": {"status": "completed"}, "active": {"status": "running"}})
    monkeypatch.setattr(jobs, "_finished_times", {"old": 0})
    monkeypatch.setattr(jobs.time, "monotonic", lambda: 4000)
    assert jobs.get_job("old") is None
    assert jobs.get_job("active") == {"status": "running"}


def test_capacity_evicts_completed_jobs_first(monkeypatch):
    monkeypatch.setattr(jobs, "MAX_JOBS", 2)
    monkeypatch.setattr(jobs, "_jobs", {
        "old": {"status": "completed"}, "active": {"status": "running"}, "recent": {"status": "completed"},
    })
    monkeypatch.setattr(jobs, "_finished_times", {"old": 1, "recent": 2})
    monkeypatch.setattr(jobs.time, "monotonic", lambda: 3)
    assert jobs.get_job("old") is None
    assert jobs.get_job("active") is not None
    assert jobs.get_job("recent") is not None
