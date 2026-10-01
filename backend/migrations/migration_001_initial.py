"""Initial migration - create all tables."""


def migrate(conn) -> None:
    """Apply initial migration."""
    schema = """
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                normalized_title TEXT NOT NULL UNIQUE,
                sort_title TEXT,
                cover_file_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_series_normalized_title
                ON series(normalized_title);

            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER NOT NULL,
                episode_number REAL,
                season_number INTEGER,
                title TEXT,
                normalized_key TEXT NOT NULL UNIQUE,
                duration_seconds REAL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_episodes_series_id
                ON episodes(series_id);

            CREATE INDEX IF NOT EXISTS idx_episodes_normalized_key
                ON episodes(normalized_key);

            CREATE TABLE IF NOT EXISTS library_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER,
                episode_id INTEGER,
                file_type TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                relative_path TEXT NOT NULL,
                file_exists INTEGER NOT NULL DEFAULT 1,
                is_primary INTEGER NOT NULL DEFAULT 0,
                linked_at TEXT,
                missing_since TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_library_files_series_id
                ON library_files(series_id);

            CREATE INDEX IF NOT EXISTS idx_library_files_episode_id
                ON library_files(episode_id);

            CREATE INDEX IF NOT EXISTS idx_library_files_file_type
                ON library_files(file_type);

            CREATE INDEX IF NOT EXISTS idx_library_files_file_exists
                ON library_files(file_exists);

            CREATE INDEX IF NOT EXISTS idx_library_files_episode_type
                ON library_files(episode_id, file_type, file_exists, is_primary);

            CREATE TABLE IF NOT EXISTS watch_progress (
                episode_id INTEGER PRIMARY KEY,
                current_time_seconds REAL NOT NULL DEFAULT 0,
                duration_seconds REAL,
                watched_seconds REAL NOT NULL DEFAULT 0,
                completed INTEGER NOT NULL DEFAULT 0,
                last_watched_at TEXT,

                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_watch_progress_completed
                ON watch_progress(completed);

            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER,
                episode_id INTEGER,
                note_id TEXT NOT NULL UNIQUE,
                word TEXT,
                sentence TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cards_series_id
                ON cards(series_id);

            CREATE INDEX IF NOT EXISTS idx_cards_episode_id
                ON cards(episode_id);

            CREATE INDEX IF NOT EXISTS idx_cards_note_id
                ON cards(note_id);

            CREATE TABLE IF NOT EXISTS jimaku_cache (
                cache_key TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        """
    for statement in schema.split(";"):
        if statement.strip():
            conn.execute(statement)

    conn.execute(
        """
        INSERT INTO schema_meta(key, value)
        VALUES('schema_version', '1')
        ON CONFLICT(key) DO NOTHING
        """
    )
