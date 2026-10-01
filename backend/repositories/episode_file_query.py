"""Shared primary-file selection for queries that alias episodes as e."""


def primary_file_id_sql(file_type: str, *, existing: bool = True) -> str:
    if file_type not in {"video", "subtitle"}:
        raise ValueError("Unsupported episode file type")
    availability = "AND file_exists = 1" if existing else ""
    return (
        "SELECT id FROM library_files "
        f"WHERE episode_id = e.id AND file_type = '{file_type}' {availability} "
        "ORDER BY is_primary DESC, id ASC LIMIT 1"
    )
