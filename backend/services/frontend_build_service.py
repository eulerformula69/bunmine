import os
import shutil
import subprocess
from pathlib import Path


def _npm_command() -> str | None:
    return shutil.which("npm.cmd") or shutil.which("npm")


def _run_npm(project_dir: Path, args: list[str]) -> None:
    npm = _npm_command()
    if not npm:
        raise RuntimeError("npm is not available. Install Node.js or run with BUNMINE_SKIP_FRONTEND_BUILD=1.")

    subprocess.run([npm, *args], cwd=project_dir, check=True)


def _frontend_dependencies_installed(project_dir: Path) -> bool:
    executable_name = "tsc.cmd" if os.name == "nt" else "tsc"
    return (project_dir / "node_modules" / ".bin" / executable_name).exists()


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

    print("Building frontend TypeScript...")
    _run_npm(project_dir, ["run", "build"])
