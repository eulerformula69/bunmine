from pathlib import Path

from backend.services import frontend_build_service


def _write_build_inputs(project_dir: Path) -> None:
    (project_dir / "tools").mkdir()
    for relative_path in frontend_build_service._DEPENDENCY_BUILD_INPUTS:
        path = project_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"contents of {relative_path}", encoding="utf-8")


def _write_dependency_outputs(project_dir: Path) -> None:
    for relative_path in (
        "frontend/libs/media-captions/media-captions.js",
        "frontend/libs/kuromoji/kuromoji.js",
    ):
        path = project_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("built", encoding="utf-8")
    (project_dir / "frontend/libs/kuromoji/dict").mkdir(parents=True)


def test_dependency_assets_are_reused_until_an_input_changes(tmp_path):
    _write_build_inputs(tmp_path)
    _write_dependency_outputs(tmp_path)
    fingerprint = frontend_build_service._dependency_build_fingerprint(tmp_path)
    frontend_build_service._write_dependency_build_stamp(tmp_path, fingerprint)

    assert frontend_build_service._dependency_assets_are_current(tmp_path, fingerprint)

    (tmp_path / "package-lock.json").write_text("changed", encoding="utf-8")
    changed_fingerprint = frontend_build_service._dependency_build_fingerprint(tmp_path)
    assert changed_fingerprint != fingerprint
    assert not frontend_build_service._dependency_assets_are_current(tmp_path, changed_fingerprint)


def test_missing_dependency_output_invalidates_stamp(tmp_path):
    _write_build_inputs(tmp_path)
    fingerprint = frontend_build_service._dependency_build_fingerprint(tmp_path)
    frontend_build_service._write_dependency_build_stamp(tmp_path, fingerprint)

    assert not frontend_build_service._dependency_assets_are_current(tmp_path, fingerprint)
