"""Index the primary-file lookup for existing libraries."""


def migrate(conn) -> None:
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_library_files_episode_type "
        "ON library_files(episode_id, file_type, file_exists, is_primary)"
    )
