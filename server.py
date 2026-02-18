import json
import os
import sqlite3
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT_DIR, 'data.sqlite')
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', '3000'))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with db_connection() as connection:
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS worker_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                job_category TEXT,
                score REAL,
                reviewer TEXT,
                notes TEXT,
                rated_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                profile_status TEXT,
                background_info TEXT
            )
            '''
        )

        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS worker_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id INTEGER NOT NULL,
                job_category TEXT NOT NULL,
                score REAL NOT NULL,
                reviewer TEXT NOT NULL,
                notes TEXT,
                rated_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
            )
            '''
        )

        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS worker_profile_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                score REAL NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
            )
            '''
        )

        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS worker_profile_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id INTEGER NOT NULL,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
            )
            '''
        )

        ensure_profile_columns(connection)
        ensure_profile_history_columns(connection)


def ensure_profile_columns(connection: sqlite3.Connection) -> None:
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(worker_profiles)').fetchall()}

    if 'profile_status' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN profile_status TEXT')

    if 'background_info' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN background_info TEXT')


def ensure_profile_history_columns(connection: sqlite3.Connection) -> None:
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(worker_profile_history)').fetchall()}

    if 'note' not in columns:
        connection.execute('ALTER TABLE worker_profile_history ADD COLUMN note TEXT')


def validate_rating_payload(payload: dict, require_worker_name: bool = False) -> str | None:
    if require_worker_name:
        worker_name = str(payload.get('workerName', '')).strip()
        if len(worker_name) < 2:
            return 'workerName is required and must be at least 2 characters'

    category = str(payload.get('category', '')).strip()
    reviewer = str(payload.get('reviewer', '')).strip()

    try:
        score = float(payload.get('score', ''))
    except (TypeError, ValueError):
        score = None

    if not category:
        return 'Missing required field: category'
    if score is None or score < -10 or score > 10:
        return 'score must be a number between -10 and 10'
    if not reviewer:
        return 'Missing required field: reviewer'

    return None


def validate_history_entries(entries: list[dict]) -> str | None:
    for entry in entries:
        category = str(entry.get('category', '')).strip()
        if not category:
            return 'Each history entry requires a category'

        try:
            score = float(entry.get('score', ''))
        except (TypeError, ValueError):
            score = None

        if score is None or score < 1 or score > 10:
            return 'Each history entry score must be a number between 1 and 10'

    return None


def validate_profile_notes(notes: list[dict]) -> str | None:
    for note_entry in notes:
        note = str(note_entry.get('note', '')).strip()
        if not note:
            return 'Each profile note requires note text'

    return None


def validate_profile_payload(payload: dict) -> str | None:
    name = str(payload.get('name', payload.get('workerName', ''))).strip()
    status = str(payload.get('status', '')).strip()

    if len(name) < 2:
        return 'name is required and must be at least 2 characters'
    if not status:
        return 'Missing required field: status'

    history_entries = payload.get('historyEntries', payload.get('history', []))
    if history_entries is None:
        history_entries = []

    if not isinstance(history_entries, list):
        return 'historyEntries must be an array'

    profile_notes = payload.get('profileNotes', payload.get('notesTimeline', []))
    if profile_notes is None:
        profile_notes = []

    if not isinstance(profile_notes, list):
        return 'profileNotes must be an array'

    notes_error = validate_profile_notes(profile_notes)
    if notes_error:
        return notes_error

    return validate_history_entries(history_entries)


def fetch_ratings(connection: sqlite3.Connection, worker_id: int) -> list[dict]:
    rows = connection.execute(
        '''
        SELECT id, job_category AS category, score, reviewer, notes AS note, rated_at AS ratedAt
        FROM worker_ratings
        WHERE worker_id = ?
        ORDER BY datetime(rated_at) ASC, id ASC
        ''',
        (worker_id,),
    ).fetchall()

    return [dict(row) for row in rows]


def fetch_profile_history(connection: sqlite3.Connection, worker_id: int) -> list[dict]:
    rows = connection.execute(
        '''
        SELECT id, category, score, note, created_at AS createdAt
        FROM worker_profile_history
        WHERE worker_id = ?
        ORDER BY id ASC
        ''',
        (worker_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def replace_profile_history(connection: sqlite3.Connection, worker_id: int, entries: list[dict]) -> None:
    connection.execute('DELETE FROM worker_profile_history WHERE worker_id = ?', (worker_id,))
    for entry in entries:
        connection.execute(
            '''
            INSERT INTO worker_profile_history (worker_id, category, score, note, created_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (
                worker_id,
                str(entry.get('category')).strip(),
                float(entry.get('score')),
                str(entry.get('note', '')).strip() or None,
                entry.get('createdAt') or now_iso(),
            ),
        )


def fetch_profile_notes(connection: sqlite3.Connection, worker_id: int) -> list[dict]:
    rows = connection.execute(
        '''
        SELECT id, note, created_at AS createdAt
        FROM worker_profile_notes
        WHERE worker_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
        ''',
        (worker_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def replace_profile_notes(connection: sqlite3.Connection, worker_id: int, notes: list[dict]) -> None:
    connection.execute('DELETE FROM worker_profile_notes WHERE worker_id = ?', (worker_id,))
    for note_entry in notes:
        connection.execute(
            '''
            INSERT INTO worker_profile_notes (worker_id, note, created_at)
            VALUES (?, ?, ?)
            ''',
            (worker_id, str(note_entry.get('note')).strip(), note_entry.get('createdAt') or now_iso()),
        )


def build_profile(connection: sqlite3.Connection, profile_row: sqlite3.Row) -> dict:
    ratings = fetch_ratings(connection, int(profile_row['id']))
    history_entries = fetch_profile_history(connection, int(profile_row['id']))
    profile_notes = fetch_profile_notes(connection, int(profile_row['id']))
    categories = sorted({entry['category'] for entry in ratings})
    overall_score = round(sum(float(entry['score']) for entry in ratings) / len(ratings), 2) if ratings else 0

    return {
        'id': profile_row['id'],
        'name': profile_row['name'],
        'jobCategory': profile_row['job_category'],
        'score': profile_row['score'],
        'reviewer': profile_row['reviewer'],
        'notes': profile_row['notes'],
        'ratedAt': profile_row['rated_at'],
        'createdAt': profile_row['created_at'],
        'updatedAt': profile_row['updated_at'],
        'profileStatus': profile_row['profile_status'],
        'backgroundInfo': profile_row['background_info'],
        'ratings': ratings,
        'historyEntries': history_entries,
        'profileNotes': profile_notes,
        'jobCategories': categories,
        'overallScore': overall_score,
    }


class WorkerAPIHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict | list) -> None:
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_no_content(self) -> None:
        self.send_response(204)
        self.end_headers()

    def _read_json_body(self) -> dict:
        length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(length) if length else b'{}'
        return json.loads(raw_body.decode('utf-8')) if raw_body else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self._send_json(200, {'ok': True})
            return

        if path == '/api/profiles':
            with db_connection() as connection:
                rows = connection.execute('SELECT * FROM worker_profiles ORDER BY name ASC').fetchall()
                profiles = [build_profile(connection, row) for row in rows]
            self._send_json(200, profiles)
            return

        if path.startswith('/api/profiles/'):
            profile_id = path.split('/')[-1]
            if not profile_id.isdigit():
                self._send_json(404, {'message': 'Profile not found'})
                return

            with db_connection() as connection:
                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (int(profile_id),)).fetchone()
                if row is None:
                    self._send_json(404, {'message': 'Profile not found'})
                    return
                profile = build_profile(connection, row)
            self._send_json(200, profile)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/profiles/create':
            payload = self._read_json_body()
            validation_error = validate_profile_payload(payload)
            if validation_error:
                self._send_json(400, {'message': validation_error})
                return

            worker_name = str(payload.get('name', payload.get('workerName'))).strip()
            profile_status = str(payload.get('status')).strip()
            background_info = str(payload.get('background', payload.get('backgroundInfo', ''))).strip()
            history_entries = payload.get('historyEntries', payload.get('history', [])) or []
            profile_notes = payload.get('profileNotes', payload.get('notesTimeline', [])) or []

            with db_connection() as connection:
                existing = connection.execute(
                    'SELECT * FROM worker_profiles WHERE lower(name) = lower(?)',
                    (worker_name,),
                ).fetchone()

                if existing is None:
                    cursor = connection.execute(
                        '''
                        INSERT INTO worker_profiles (name, profile_status, background_info)
                        VALUES (?, ?, ?)
                        ''',
                        (worker_name, profile_status, background_info),
                    )
                    worker_id = int(cursor.lastrowid)
                    status = 201
                else:
                    worker_id = int(existing['id'])
                    connection.execute(
                        '''
                        UPDATE worker_profiles
                        SET profile_status = ?, background_info = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        ''',
                        (profile_status, background_info, worker_id),
                    )
                    status = 200

                replace_profile_history(connection, worker_id, history_entries)
                replace_profile_notes(connection, worker_id, profile_notes)
                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                profile = build_profile(connection, row)

            self._send_json(status, profile)
            return

        if path == '/api/profiles':
            payload = self._read_json_body()
            validation_error = validate_rating_payload(payload, require_worker_name=True)
            if validation_error:
                self._send_json(400, {'message': validation_error})
                return

            worker_name = str(payload.get('workerName')).strip()
            category = str(payload.get('category')).strip()
            score = float(payload.get('score'))
            reviewer = str(payload.get('reviewer')).strip()
            note = str(payload.get('note', '')).strip()
            rated_at = payload.get('ratedAt') or now_iso()

            with db_connection() as connection:
                existing = connection.execute(
                    'SELECT * FROM worker_profiles WHERE lower(name) = lower(?)',
                    (worker_name,),
                ).fetchone()

                if existing is None:
                    cursor = connection.execute(
                        '''
                        INSERT INTO worker_profiles (name, job_category, score, reviewer, notes, rated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ''',
                        (worker_name, category, score, reviewer, note, rated_at),
                    )
                    worker_id = int(cursor.lastrowid)
                    status = 201
                else:
                    worker_id = int(existing['id'])
                    connection.execute(
                        '''
                        UPDATE worker_profiles
                        SET job_category = ?, score = ?, reviewer = ?, notes = ?, rated_at = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        ''',
                        (category, score, reviewer, note, rated_at, worker_id),
                    )
                    status = 200

                connection.execute(
                    '''
                    INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (worker_id, category, score, reviewer, note, rated_at),
                )

                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                profile = build_profile(connection, row)

            self._send_json(status, profile)
            return

        if path.startswith('/api/profiles/') and path.endswith('/ratings'):
            segments = path.strip('/').split('/')
            if len(segments) != 4 or not segments[2].isdigit():
                self._send_json(404, {'message': 'Profile not found'})
                return

            worker_id = int(segments[2])
            payload = self._read_json_body()
            validation_error = validate_rating_payload(payload)
            if validation_error:
                self._send_json(400, {'message': validation_error})
                return

            category = str(payload.get('category')).strip()
            score = float(payload.get('score'))
            reviewer = str(payload.get('reviewer')).strip()
            note = str(payload.get('note', '')).strip()
            rated_at = payload.get('ratedAt') or now_iso()

            with db_connection() as connection:
                existing = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                if existing is None:
                    self._send_json(404, {'message': 'Profile not found'})
                    return

                connection.execute(
                    '''
                    INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (worker_id, category, score, reviewer, note, rated_at),
                )
                connection.execute(
                    '''
                    UPDATE worker_profiles
                    SET job_category = ?, score = ?, reviewer = ?, notes = ?, rated_at = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    ''',
                    (category, score, reviewer, note, rated_at, worker_id),
                )

                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                profile = build_profile(connection, row)

            self._send_json(201, profile)
            return

        self._send_json(404, {'message': 'Not found'})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not path.startswith('/api/profiles/'):
            self._send_json(404, {'message': 'Not found'})
            return

        profile_id = path.split('/')[-1]
        if not profile_id.isdigit():
            self._send_json(404, {'message': 'Profile not found'})
            return

        payload = self._read_json_body()

        with db_connection() as connection:
            existing = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (int(profile_id),)).fetchone()
            if existing is None:
                self._send_json(404, {'message': 'Profile not found'})
                return

            name = str(payload.get('name', existing['name'])).strip()
            category = str(payload.get('category', existing['job_category'] or '')).strip()
            reviewer = str(payload.get('reviewer', existing['reviewer'] or '')).strip()
            note = str(payload.get('note', payload.get('notes', existing['notes'] or ''))).strip()
            profile_status = str(payload.get('status', existing['profile_status'] or '')).strip()
            background_info = str(payload.get('background', payload.get('backgroundInfo', existing['background_info'] or ''))).strip()
            rated_at = payload.get('ratedAt') or existing['rated_at'] or now_iso()

            try:
                score = float(payload.get('score', existing['score']))
            except (TypeError, ValueError):
                score = None

            if len(name) < 2:
                self._send_json(400, {'message': 'name must be at least 2 characters'})
                return

            if score is None or score < -10 or score > 10:
                self._send_json(400, {'message': 'score must be a number between -10 and 10'})
                return

            connection.execute(
                '''
                UPDATE worker_profiles
                SET name = ?, job_category = ?, score = ?, reviewer = ?, notes = ?, rated_at = ?, profile_status = ?, background_info = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (name, category, score, reviewer, note, rated_at, profile_status, background_info, int(profile_id)),
            )

            if payload.get('logRating') is True:
                connection.execute(
                    '''
                    INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (int(profile_id), category, score, reviewer, note, rated_at),
                )

            row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (int(profile_id),)).fetchone()
            profile = build_profile(connection, row)

        self._send_json(200, profile)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/profiles':
            self._send_json(404, {'message': 'Not found'})
            return

        with db_connection() as connection:
            connection.execute('DELETE FROM worker_profile_notes')
            connection.execute('DELETE FROM worker_profile_history')
            connection.execute('DELETE FROM worker_ratings')
            connection.execute('DELETE FROM worker_profiles')

        self._send_no_content()


if __name__ == '__main__':
    initialize_database()
    server = ThreadingHTTPServer((HOST, PORT), WorkerAPIHandler)
    print(f'Server listening on http://{HOST}:{PORT}')
    server.serve_forever()
