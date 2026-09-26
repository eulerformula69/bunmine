import json
import time
import uuid

from backend.repositories.connection import get_db


def migrate_candidates(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS mining_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot TEXT NOT NULL,
            source_identity TEXT NOT NULL,
            episode_id INTEGER,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending', 'accepted', 'rejected')),
            anki_note_id INTEGER UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_candidates_status ON mining_candidates(status, id)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS mining_acquire (
            singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
            candidate_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires REAL NOT NULL
        )
    """)


def decode(row):
    result = dict(row)
    result['snapshot'] = json.loads(result['snapshot'])
    return result


def list_candidates(db_path):
    with get_db(db_path) as conn:
        return [decode(row) for row in conn.execute(
            "SELECT * FROM mining_candidates WHERE status = 'pending' ORDER BY id"
        )]


def get_candidate(db_path, candidate_id):
    with get_db(db_path) as conn:
        row = conn.execute("SELECT * FROM mining_candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise ValueError('Candidate not found')
        return decode(row)


def create_candidate(db_path, snapshot, identity, episode_id):
    with get_db(db_path) as conn:
        cursor = conn.execute(
            'INSERT INTO mining_candidates(snapshot, source_identity, episode_id) VALUES (?, ?, ?)',
            (json.dumps(snapshot, ensure_ascii=False), identity, episode_id),
        )
        candidate_id = cursor.lastrowid
    return get_candidate(db_path, candidate_id)


def change_candidate(db_path, candidate_id, action, token=None, note_id=None):
    with get_db(db_path) as conn:
        conn.execute('BEGIN IMMEDIATE')
        now = time.time()
        conn.execute('DELETE FROM mining_acquire WHERE expires < ?', (now,))
        row = conn.execute('SELECT * FROM mining_candidates WHERE id = ?', (candidate_id,)).fetchone()
        if not row or row['status'] != 'pending':
            raise ValueError('Candidate is no longer pending')
        lock = conn.execute('SELECT * FROM mining_acquire').fetchone()
        if action == 'claim':
            if lock:
                raise ValueError('Another candidate is active. Finish it or wait two minutes.')
            token = uuid.uuid4().hex
            conn.execute('INSERT INTO mining_acquire VALUES (1, ?, ?, ?)', (candidate_id, token, now + 120))
            return {'token': token, 'ankiNoteId': row['anki_note_id']}
        if action == 'reject':
            if lock:
                raise ValueError('Finish the active candidate first')
            conn.execute("UPDATE mining_candidates SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (candidate_id,))
            return {}
        if not lock or lock['candidate_id'] != candidate_id or lock['token'] != token:
            raise ValueError('The review session expired. Try again.')
        if action == 'renew':
            conn.execute('UPDATE mining_acquire SET expires = ?', (now + 120,))
        elif action == 'bind':
            if not isinstance(note_id, int) or isinstance(note_id, bool) or note_id <= 0:
                raise ValueError('Invalid Anki note ID')
            if row['anki_note_id'] and row['anki_note_id'] != note_id:
                raise ValueError('Candidate already has a different Anki note')
            conn.execute('UPDATE mining_candidates SET anki_note_id = ? WHERE id = ?', (note_id, candidate_id))
        elif action == 'accept':
            if not row['anki_note_id']:
                raise ValueError('Anki note ID is required')
            conn.execute("UPDATE mining_candidates SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (candidate_id,))
            conn.execute('DELETE FROM mining_acquire')
        elif action == 'release':
            conn.execute('DELETE FROM mining_acquire')
        else:
            raise ValueError('Unknown candidate action')
        return {}
