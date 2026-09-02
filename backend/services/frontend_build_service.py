import hashlib
import os
import shutil
import subprocess
from pathlib import Path


_DEPENDENCY_BUILD_INPUTS = (
    "package.json",
    "package-lock.json",
    "tools/build-media-captions.mjs",
    "tools/build-kuromoji.mjs",
)
_DEPENDENCY_BUILD_STAMP = "dist/.frontend-dependencies.sha256"


def _npm_command() -> str | None:
    return shutil.which("npm.cmd") or shutil.which("npm")


def _run_npm(project_dir: Path, args: list[str]) -> None:
    npm = _npm_command()
    if not npm:
        raise RuntimeError("npm is not available. Install Node.js or run with BUNMINE_SKIP_FRONTEND_BUILD=1.")

    subprocess.run([npm, *args], cwd=project_dir, check=True)


def _frontend_dependencies_installed(project_dir: Path) -> bool:
    executable_name = "tsc.cmd" if os.name == "nt" else "tsc"
    esbuild_name = "esbuild.cmd" if os.name == "nt" else "esbuild"
    node_modules = project_dir / "node_modules"
    return all((
        (node_modules / ".bin" / executable_name).exists(),
        (node_modules / ".bin" / esbuild_name).exists(),
        (node_modules / "media-captions" / "package.json").exists(),
        (node_modules / "kuromoji" / "package.json").exists(),
    ))


def _dependency_build_fingerprint(project_dir: Path) -> str:
    digest = hashlib.sha256()
    for relative_path in _DEPENDENCY_BUILD_INPUTS:
        path = project_dir / relative_path
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        if path.exists():
            digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _dependency_assets_are_current(project_dir: Path, fingerprint: str) -> bool:
    required_outputs = (
        project_dir / "frontend/libs/media-captions/media-captions.js",
        project_dir / "frontend/libs/kuromoji/kuromoji.js",
        project_dir / "frontend/libs/kuromoji/dict",
    )
    stamp_path = project_dir / _DEPENDENCY_BUILD_STAMP
    if not all(path.exists() for path in required_outputs) or not stamp_path.exists():
        return False
    return stamp_path.read_text(encoding="utf-8").strip() == fingerprint


def _write_dependency_build_stamp(project_dir: Path, fingerprint: str) -> None:
    stamp_path = project_dir / _DEPENDENCY_BUILD_STAMP
    stamp_path.parent.mkdir(parents=True, exist_ok=True)
    stamp_path.write_text(f"{fingerprint}\n", encoding="utf-8")


def build_frontend_on_startup(project_dir: Path) -> None:
    if os.getenv("BUNMINE_SKIP_FRONTEND_BUILD", "").strip().lower() in {"1", "true", "yes"}:
        print("Frontend build skipped: BUNMINE_SKIP_FRONTEND_BUILD is set.")
        return

    if not (project_dir / "package.json").exists():
        print("Frontend build skipped: package.json was not found.")
        return

    if not _frontend_dependencies_installed(project_dir):
        print("Installing frontend dependencies...")
        _run_npm(project_dir, ["install"])

    fingerprint = _dependency_build_fingerprint(project_dir)
    if _dependency_assets_are_current(project_dir, fingerprint):
        print("Frontend dependency assets are current; skipping their rebuild.")
    else:
        print("Building frontend dependency assets...")
        _run_npm(project_dir, ["run", "build:libs"])
        _write_dependency_build_stamp(project_dir, fingerprint)

    print("Building changed TypeScript files...")
    _run_npm(project_dir, ["run", "build:ts"])
