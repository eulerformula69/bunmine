from functools import cache
from pathlib import Path

IGNORE_FILENAME = ".bunmineignore"


def library_folder_is_ignored(library_root: Path):
    ignore_file = library_root / IGNORE_FILENAME
    excluded = set()
    if ignore_file.is_file():
        for line in ignore_file.read_text(encoding="utf-8-sig").splitlines():
            rule = line.strip()
            if not rule or rule.startswith("#"):
                continue
            relative = Path(rule.replace("\\", "/").removeprefix("/").rstrip("/"))
            if relative.parts and not relative.anchor and ".." not in relative.parts:
                excluded.add(library_root / relative)

    @cache
    def is_ignored(folder: Path) -> bool:
        while folder != library_root and folder.is_relative_to(library_root):
            if folder in excluded or (folder / IGNORE_FILENAME).is_file():
                return True
            folder = folder.parent
        return False

    return is_ignored
