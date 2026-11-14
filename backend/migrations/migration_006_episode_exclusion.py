"""Keep manual episode exclusions across library scans."""


def migrate(conn) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(episodes)")}
    if "is_ignored" not in columns:
        conn.execute(
            "ALTER TABLE episodes ADD COLUMN is_ignored INTEGER NOT NULL DEFAULT 0 CHECK(is_ignored IN (0, 1))"
        )
