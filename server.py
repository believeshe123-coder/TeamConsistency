import json
import os
import queue
import sqlite3
import math
import re
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT_DIR, 'data.sqlite')
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', '3000'))

EVENT_SUBSCRIBERS: set[queue.Queue] = set()
EVENT_SUBSCRIBERS_LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    return connection


def normalize_worker_name(name: str) -> str:
    return re.sub(r'\s+', ' ', str(name or '').strip()).lower()


def normalize_employee_id(employee_id: str | None) -> str | None:
    cleaned = str(employee_id or '').strip()
    if not cleaned:
        return None
    return re.sub(r'\s+', '', cleaned).lower()


def canonical_worker_key(name: str, employee_id: str | None = None) -> str:
    normalized_name = normalize_worker_name(name)
    normalized_employee_id = normalize_employee_id(employee_id)
    return f'{normalized_name}::{normalized_employee_id}' if normalized_employee_id else normalized_name


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
                background_info TEXT,
                external_employee_id TEXT,
                canonical_name TEXT,
                canonical_worker_key TEXT
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
        initialize_admin_catalog(connection)
        ensure_worker_canonical_columns(connection)
        ensure_uniqueness_indexes(connection)


def ensure_profile_columns(connection: sqlite3.Connection) -> None:
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(worker_profiles)').fetchall()}

    if 'profile_status' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN profile_status TEXT')

    if 'background_info' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN background_info TEXT')

    if 'external_employee_id' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN external_employee_id TEXT')

    if 'canonical_name' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN canonical_name TEXT')

    if 'canonical_worker_key' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN canonical_worker_key TEXT')


def ensure_profile_history_columns(connection: sqlite3.Connection) -> None:
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(worker_profile_history)').fetchall()}

    if 'note' not in columns:
        connection.execute('ALTER TABLE worker_profile_history ADD COLUMN note TEXT')


def initialize_admin_catalog(connection: sqlite3.Connection) -> None:
    connection.execute(
        '''
        CREATE TABLE IF NOT EXISTS admin_catalog (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )

    defaults = {
        'job_types': ['Loading dock', 'Warehouse', 'Picker'],
        'criteria_names': ['Late / on time', 'Work quality'],
    }

    for key, value in defaults.items():
        connection.execute(
            '''
            INSERT INTO admin_catalog (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO NOTHING
            ''',
            (key, json.dumps(value)),
        )


def ensure_worker_canonical_columns(connection: sqlite3.Connection) -> None:
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(worker_profiles)').fetchall()}

    if 'external_employee_id' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN external_employee_id TEXT')

    if 'canonical_name' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN canonical_name TEXT')

    if 'canonical_worker_key' not in columns:
        connection.execute('ALTER TABLE worker_profiles ADD COLUMN canonical_worker_key TEXT')

    rows = connection.execute('SELECT id, name, external_employee_id FROM worker_profiles').fetchall()
    for row in rows:
        employee_id = normalize_employee_id(row['external_employee_id'])
        connection.execute(
            '''
            UPDATE worker_profiles
            SET external_employee_id = ?, canonical_name = ?, canonical_worker_key = ?
            WHERE id = ?
            ''',
            (
                employee_id,
                normalize_worker_name(row['name']),
                canonical_worker_key(row['name'], employee_id),
                int(row['id']),
            ),
        )


def ensure_uniqueness_indexes(connection: sqlite3.Connection) -> None:
    connection.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_profiles_external_employee_id ON worker_profiles(external_employee_id) WHERE external_employee_id IS NOT NULL'
    )
    connection.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_profiles_canonical_key ON worker_profiles(canonical_worker_key) WHERE canonical_worker_key IS NOT NULL'
    )


def find_profile_by_rating_identity(
    connection: sqlite3.Connection,
    worker_name: str,
    canonical_key: str,
    external_employee_id: str | None,
) -> sqlite3.Row | None:
    existing = connection.execute(
        'SELECT * FROM worker_profiles WHERE canonical_worker_key = ?',
        (canonical_key,),
    ).fetchone()
    if existing is not None:
        return existing

    if external_employee_id is not None:
        return None

    normalized_name = normalize_worker_name(worker_name)
    name_matches = connection.execute(
        'SELECT * FROM worker_profiles WHERE canonical_name = ? ORDER BY updated_at DESC, id DESC',
        (normalized_name,),
    ).fetchall()
    if len(name_matches) == 1:
        return name_matches[0]

    return None


def load_admin_list(connection: sqlite3.Connection, key: str, default: list[str] | None = None) -> list[str]:
    row = connection.execute('SELECT value FROM admin_catalog WHERE key = ?', (key,)).fetchone()
    if row is None:
        return default or []

    try:
        parsed = json.loads(row['value'])
    except json.JSONDecodeError:
        return default or []

    if not isinstance(parsed, list):
        return default or []

    unique: list[str] = []
    seen = set()
    for item in parsed:
        text = str(item or '').strip()
        lower = text.lower()
        if text and lower not in seen:
            seen.add(lower)
            unique.append(text)
    return unique


def save_admin_list(connection: sqlite3.Connection, key: str, values: list[str]) -> None:
    connection.execute(
        '''
        INSERT INTO admin_catalog (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        ''',
        (key, json.dumps(values)),
    )


def load_admin_value(connection: sqlite3.Connection, key: str):
    row = connection.execute('SELECT value FROM admin_catalog WHERE key = ?', (key,)).fetchone()
    if row is None:
        return None

    try:
        return json.loads(row['value'])
    except json.JSONDecodeError:
        return None


def save_admin_value(connection: sqlite3.Connection, key: str, value) -> None:
    connection.execute(
        '''
        INSERT INTO admin_catalog (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        ''',
        (key, json.dumps(value)),
    )


def validate_allowed_rating_values(connection: sqlite3.Connection, payload: dict) -> str | None:
    category = str(payload.get('category', '')).strip()
    allowed_job_types = load_admin_list(connection, 'job_types')
    if category and allowed_job_types and category.lower() not in {item.lower() for item in allowed_job_types}:
        return f'category must be one of the admin-defined job types: {", ".join(allowed_job_types)}'

    selected_criteria = payload.get('selectedCriteria', [])
    if selected_criteria is None:
        selected_criteria = []
    if not isinstance(selected_criteria, list):
        return 'selectedCriteria must be an array when provided'

    allowed_criteria = load_admin_list(connection, 'criteria_names')
    lookup = {item.lower() for item in allowed_criteria}
    for entry in selected_criteria:
        criterion = str((entry or {}).get('criterion', '')).strip()
        if not criterion:
            return 'Each selectedCriteria entry must include criterion'
        if lookup and criterion.lower() not in lookup:
            return f'criterion "{criterion}" is not admin-defined'

    return None


def validate_rating_payload(payload: dict, require_worker_name: bool = False) -> str | None:
    if require_worker_name:
        worker_name = str(payload.get('workerName', '')).strip()
        if len(worker_name) < 2:
            return 'workerName is required and must be at least 2 characters'

    reviewer = str(payload.get('reviewer', '')).strip()

    try:
        score = float(payload.get('score', ''))
    except (TypeError, ValueError):
        score = None

    if score is None or score < -5 or score > 5:
        return 'score must be a number between -5 and 5'
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

        if score is None or score < -5 or score > 5:
            return 'Each history entry score must be a number between -5 and 5'

    return None


def validate_profile_notes(notes: list[dict]) -> str | None:
    for note_entry in notes:
        note = str(note_entry.get('note', '')).strip()
        if not note:
            return 'Each profile note requires note text'

    return None


def validate_profile_payload(payload: dict) -> str | None:
    name = str(payload.get('name', payload.get('workerName', ''))).strip()
    if len(name) < 2:
        return 'name is required and must be at least 2 characters'

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


def normalize_history_entries(payload: dict, default: list[dict] | None = None) -> list[dict]:
    entries = payload.get('historyEntries', payload.get('history', default if default is not None else []))
    return entries or []


def normalize_profile_notes(payload: dict, default: list[dict] | None = None) -> list[dict]:
    notes = payload.get('profileNotes', payload.get('notesTimeline', default if default is not None else []))
    return notes or []


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


def append_profile_history_entry(
    connection: sqlite3.Connection,
    worker_id: int,
    category: str,
    score: float,
    note: str,
    created_at: str,
) -> None:
    connection.execute(
        '''
        INSERT INTO worker_profile_history (worker_id, category, score, note, created_at)
        VALUES (?, ?, ?, ?, ?)
        ''',
        (worker_id, category, score, note or None, created_at),
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


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def to_five_point_scale(raw_score: float) -> float:
    return round((clamp(raw_score, -5, 5) + 5) / 2, 2)


def is_punctuality_category(category: str) -> bool:
    normalized = category.strip().lower()
    return any(token in normalized for token in ('punctuality', 'attendance', 'timeliness', 'late'))


def score_profile_metrics(ratings: list[dict]) -> dict:
    if not ratings:
        return {
            'normalizedOverallScore': 0,
            'consistencyScore': 0,
            'currentPositiveStreak': 0,
            'bestPositiveStreak': 0,
            'lateTrendWeightApplied': False,
            'lateTrend': 'No punctuality trend yet',
        }

    sorted_ratings = sorted(ratings, key=lambda entry: (entry.get('ratedAt') or '', entry.get('id') or 0))
    punctuality = [entry for entry in sorted_ratings if is_punctuality_category(str(entry.get('category', '')))]
    recent_punctuality = punctuality[-3:]
    late_trend_applied = len(recent_punctuality) == 3 and all(float(entry['score']) <= 0 for entry in recent_punctuality)

    weighted_scores: list[float] = []
    normalized_scores: list[float] = []
    current_streak = 0
    best_streak = 0

    for entry in sorted_ratings:
        raw_score = float(entry['score'])
        normalized_score = to_five_point_scale(raw_score)
        normalized_scores.append(normalized_score)

        if normalized_score >= 3.5:
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        else:
            current_streak = 0

        multiplier = 2 if late_trend_applied and is_punctuality_category(str(entry.get('category', ''))) else 1
        weighted_scores.append(raw_score * multiplier)

    weighted_average = sum(weighted_scores) / len(weighted_scores)
    normalized_overall_score = to_five_point_scale(weighted_average)
    streak_bonus = min(0.5, current_streak * 0.1)
    normalized_overall_score = round(clamp(normalized_overall_score + streak_bonus, 0, 5), 2)

    mean_score = sum(normalized_scores) / len(normalized_scores)
    variance = sum((score - mean_score) ** 2 for score in normalized_scores) / len(normalized_scores)
    consistency_score = round(clamp(100 - (math.sqrt(variance) * 20), 0, 100), 2)

    late_trend = 'No punctuality trend yet'
    if late_trend_applied:
        late_trend = 'Always late trend detected; punctuality scores are doubled'
    elif recent_punctuality:
        late_trend = 'Punctuality is being monitored'

    return {
        'normalizedOverallScore': normalized_overall_score,
        'consistencyScore': consistency_score,
        'currentPositiveStreak': current_streak,
        'bestPositiveStreak': best_streak,
        'lateTrendWeightApplied': late_trend_applied,
        'lateTrend': late_trend,
    }


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
    metrics = score_profile_metrics(ratings)

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
        'externalEmployeeId': profile_row['external_employee_id'],
        'canonicalName': profile_row['canonical_name'],
        'canonicalWorkerKey': profile_row['canonical_worker_key'],
        'ratings': ratings,
        'historyEntries': history_entries,
        'profileNotes': profile_notes,
        'jobCategories': categories,
        'overallScore': metrics['normalizedOverallScore'],
        'analytics': metrics,
    }


def delete_rating(connection: sqlite3.Connection, worker_id: int, rating_id: int) -> bool:
    cursor = connection.execute('DELETE FROM worker_ratings WHERE id = ? AND worker_id = ?', (rating_id, worker_id))
    return cursor.rowcount > 0


def delete_profile_note(connection: sqlite3.Connection, worker_id: int, note_id: int) -> bool:
    cursor = connection.execute('DELETE FROM worker_profile_notes WHERE id = ? AND worker_id = ?', (note_id, worker_id))
    return cursor.rowcount > 0


def publish_change_event(event_type: str, payload: dict | None = None) -> None:
    message = {
        'type': event_type,
        'timestamp': now_iso(),
        'payload': payload or {},
    }
    with EVENT_SUBSCRIBERS_LOCK:
        subscribers = list(EVENT_SUBSCRIBERS)
    for subscriber in subscribers:
        subscriber.put(message)


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

        if path == '/api/events':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()

            event_queue: queue.Queue = queue.Queue()
            with EVENT_SUBSCRIBERS_LOCK:
                EVENT_SUBSCRIBERS.add(event_queue)

            try:
                self.wfile.write(b': connected\n\n')
                self.wfile.flush()
                while True:
                    try:
                        message = event_queue.get(timeout=20)
                        event_type = str(message.get('type', 'change'))
                        body = json.dumps(message)
                        self.wfile.write(f'event: {event_type}\n'.encode('utf-8'))
                        self.wfile.write(f'data: {body}\n\n'.encode('utf-8'))
                    except queue.Empty:
                        self.wfile.write(b': keepalive\n\n')
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                with EVENT_SUBSCRIBERS_LOCK:
                    EVENT_SUBSCRIBERS.discard(event_queue)
            return

        if path == '/api/health':
            self._send_json(200, {'ok': True})
            return

        if path == '/api/profiles':
            with db_connection() as connection:
                rows = connection.execute('SELECT * FROM worker_profiles ORDER BY name ASC').fetchall()
                profiles = [build_profile(connection, row) for row in rows]
            self._send_json(200, profiles)
            return

        if path == '/api/admin/catalog':
            with db_connection() as connection:
                self._send_json(
                    200,
                    {
                        'jobTypes': load_admin_list(connection, 'job_types'),
                        'criteriaNames': load_admin_list(connection, 'criteria_names'),
                    },
                )
            return

        if path == '/api/admin/settings':
            key = parse_qs(parsed.query).get('key', [''])[0].strip()
            if not key:
                self._send_json(400, {'message': 'key query parameter is required'})
                return

            with db_connection() as connection:
                value = load_admin_value(connection, key)

            self._send_json(200, {'key': key, 'value': value})
            return

        if path == '/api/admin/maintenance-report':
            with db_connection() as connection:
                duplicates = connection.execute(
                    '''
                    SELECT canonical_name AS canonicalName, COUNT(*) AS count,
                           GROUP_CONCAT(name || ' (#' || id || ')', '; ') AS workers
                    FROM worker_profiles
                    GROUP BY canonical_name
                    HAVING COUNT(*) > 1
                    ORDER BY COUNT(*) DESC, canonical_name ASC
                    '''
                ).fetchall()
                orphaned_ratings = connection.execute(
                    '''
                    SELECT COUNT(*) AS count
                    FROM worker_ratings r
                    LEFT JOIN worker_profiles p ON p.id = r.worker_id
                    WHERE p.id IS NULL
                    '''
                ).fetchone()['count']
                orphaned_history = connection.execute(
                    '''
                    SELECT COUNT(*) AS count
                    FROM worker_profile_history h
                    LEFT JOIN worker_profiles p ON p.id = h.worker_id
                    WHERE p.id IS NULL
                    '''
                ).fetchone()['count']
                orphaned_notes = connection.execute(
                    '''
                    SELECT COUNT(*) AS count
                    FROM worker_profile_notes n
                    LEFT JOIN worker_profiles p ON p.id = n.worker_id
                    WHERE p.id IS NULL
                    '''
                ).fetchone()['count']

            self._send_json(
                200,
                {
                    'potentialDuplicates': [dict(row) for row in duplicates],
                    'orphans': {
                        'ratings': orphaned_ratings,
                        'historyEntries': orphaned_history,
                        'profileNotes': orphaned_notes,
                    },
                },
            )
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
            external_employee_id = normalize_employee_id(payload.get('externalEmployeeId'))
            key = canonical_worker_key(worker_name, external_employee_id)
            profile_status = str(payload.get('status')).strip()
            background_info = str(payload.get('background', payload.get('backgroundInfo', ''))).strip()
            history_entries = payload.get('historyEntries', payload.get('history', [])) or []
            profile_notes = payload.get('profileNotes', payload.get('notesTimeline', [])) or []

            try:
                with db_connection() as connection:
                    existing = find_profile_by_rating_identity(
                        connection,
                        worker_name,
                        key,
                        external_employee_id,
                    )

                    if existing is None:
                        cursor = connection.execute(
                            '''
                            INSERT INTO worker_profiles (name, profile_status, background_info, external_employee_id, canonical_name, canonical_worker_key)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ''',
                            (worker_name, profile_status, background_info, external_employee_id, normalize_worker_name(worker_name), key),
                        )
                        worker_id = int(cursor.lastrowid)
                        status = 201
                    else:
                        worker_id = int(existing['id'])
                        connection.execute(
                            '''
                            UPDATE worker_profiles
                            SET profile_status = ?, background_info = ?, external_employee_id = ?, canonical_name = ?, canonical_worker_key = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            ''',
                            (profile_status, background_info, external_employee_id, normalize_worker_name(worker_name), key, worker_id),
                        )
                        status = 200

                    replace_profile_history(connection, worker_id, history_entries)
                    replace_profile_notes(connection, worker_id, profile_notes)
                    row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                    profile = build_profile(connection, row)
            except sqlite3.IntegrityError:
                self._send_json(409, {'message': 'Duplicate worker key or employee ID detected. Merge duplicates or change employee ID.'})
                return

            publish_change_event('profiles_updated', {'profileId': int(profile['id']), 'action': 'create_profile'})

            self._send_json(status, profile)
            return

        if path == '/api/profiles':
            payload = self._read_json_body()
            validation_error = validate_rating_payload(payload, require_worker_name=True)
            if validation_error:
                self._send_json(400, {'message': validation_error})
                return

            worker_name = str(payload.get('workerName')).strip()
            external_employee_id = normalize_employee_id(payload.get('externalEmployeeId'))
            key = canonical_worker_key(worker_name, external_employee_id)
            category = str(payload.get('category')).strip()
            score = float(payload.get('score'))
            reviewer = str(payload.get('reviewer')).strip()
            note = str(payload.get('note', '')).strip()
            rated_at = payload.get('ratedAt') or now_iso()

            try:
                with db_connection() as connection:
                    allowed_error = validate_allowed_rating_values(connection, payload)
                    if allowed_error:
                        self._send_json(400, {'message': allowed_error})
                        return

                    existing = find_profile_by_rating_identity(
                        connection,
                        worker_name,
                        key,
                        external_employee_id,
                    )

                    if existing is None:
                        cursor = connection.execute(
                            '''
                            INSERT INTO worker_profiles (name, job_category, score, reviewer, notes, rated_at, external_employee_id, canonical_name, canonical_worker_key)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''',
                            (worker_name, category, score, reviewer, note, rated_at, external_employee_id, normalize_worker_name(worker_name), key),
                        )
                        worker_id = int(cursor.lastrowid)
                        status = 201
                    else:
                        worker_id = int(existing['id'])
                        connection.execute(
                            '''
                            UPDATE worker_profiles
                            SET job_category = ?, score = ?, reviewer = ?, notes = ?, rated_at = ?, external_employee_id = ?, canonical_name = ?, canonical_worker_key = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            ''',
                            (category, score, reviewer, note, rated_at, external_employee_id, normalize_worker_name(worker_name), key, worker_id),
                        )
                        status = 200

                    connection.execute(
                        '''
                        INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ''',
                        (worker_id, category, score, reviewer, note, rated_at),
                    )
                    append_profile_history_entry(
                        connection,
                        worker_id,
                        category,
                        score,
                        f'Rating logged by {reviewer}' + (f': {note}' if note else ''),
                        rated_at,
                    )

                    row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                    profile = build_profile(connection, row)
            except sqlite3.IntegrityError:
                self._send_json(409, {'message': 'Duplicate worker key or employee ID detected. Merge duplicates or change employee ID.'})
                return

            publish_change_event('profiles_updated', {'profileId': int(profile['id']), 'action': 'submit_rating'})

            self._send_json(status, profile)
            return

        if path == '/api/admin/catalog':
            payload = self._read_json_body()
            job_types = payload.get('jobTypes', [])
            criteria_names = payload.get('criteriaNames', [])

            if not isinstance(job_types, list) or not isinstance(criteria_names, list):
                self._send_json(400, {'message': 'jobTypes and criteriaNames must be arrays'})
                return

            normalize = lambda values: list({str(item or '').strip().lower(): str(item or '').strip() for item in values if str(item or '').strip()}.values())
            normalized_job_types = normalize(job_types)
            normalized_criteria = normalize(criteria_names)

            with db_connection() as connection:
                save_admin_list(connection, 'job_types', normalized_job_types)
                save_admin_list(connection, 'criteria_names', normalized_criteria)

            publish_change_event('admin_catalog_updated')

            self._send_json(200, {'jobTypes': normalized_job_types, 'criteriaNames': normalized_criteria})
            return

        if path == '/api/admin/settings':
            payload = self._read_json_body()
            key = str(payload.get('key', '')).strip()
            if not key:
                self._send_json(400, {'message': 'key is required'})
                return

            value = payload.get('value')
            with db_connection() as connection:
                save_admin_value(connection, key, value)

            publish_change_event('admin_settings_updated', {'key': key})

            self._send_json(200, {'key': key, 'value': value})
            return

        if path == '/api/profiles/merge':
            payload = self._read_json_body()
            source_id = int(payload.get('sourceProfileId', 0) or 0)
            target_id = int(payload.get('targetProfileId', 0) or 0)

            if not source_id or not target_id or source_id == target_id:
                self._send_json(400, {'message': 'sourceProfileId and targetProfileId must be different numeric values'})
                return

            with db_connection() as connection:
                source = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (source_id,)).fetchone()
                target = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (target_id,)).fetchone()
                if source is None or target is None:
                    self._send_json(404, {'message': 'One or both profiles were not found'})
                    return

                connection.execute('UPDATE worker_ratings SET worker_id = ? WHERE worker_id = ?', (target_id, source_id))
                connection.execute('UPDATE worker_profile_history SET worker_id = ? WHERE worker_id = ?', (target_id, source_id))
                connection.execute('UPDATE worker_profile_notes SET worker_id = ? WHERE worker_id = ?', (target_id, source_id))
                connection.execute('DELETE FROM worker_profiles WHERE id = ?', (source_id,))
                connection.execute('UPDATE worker_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', (target_id,))

                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (target_id,)).fetchone()
                profile = build_profile(connection, row)

            publish_change_event('profiles_updated', {'profileId': target_id, 'action': 'merge'})

            self._send_json(200, profile)
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

                allowed_error = validate_allowed_rating_values(connection, payload)
                if allowed_error:
                    self._send_json(400, {'message': allowed_error})
                    return

                connection.execute(
                    '''
                    INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (worker_id, category, score, reviewer, note, rated_at),
                )
                append_profile_history_entry(
                    connection,
                    worker_id,
                    category,
                    score,
                    f'Rating logged by {reviewer}' + (f': {note}' if note else ''),
                    rated_at,
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

            publish_change_event('profiles_updated', {'profileId': worker_id, 'action': 'add_rating'})

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
            external_employee_id = normalize_employee_id(payload.get('externalEmployeeId', existing['external_employee_id']))
            key = canonical_worker_key(name, external_employee_id)
            category = str(payload.get('category', existing['job_category'] or '')).strip()
            reviewer = str(payload.get('reviewer', existing['reviewer'] or '')).strip()
            note = str(payload.get('note', payload.get('notes', existing['notes'] or ''))).strip()
            profile_status = str(payload.get('status', existing['profile_status'] or '')).strip()
            background_info = str(payload.get('background', payload.get('backgroundInfo', existing['background_info'] or ''))).strip()
            rated_at = payload.get('ratedAt') or existing['rated_at'] or now_iso()
            history_entries = normalize_history_entries(payload)
            profile_notes = normalize_profile_notes(payload)

            history_error = validate_history_entries(history_entries)
            if history_error:
                self._send_json(400, {'message': history_error})
                return

            notes_error = validate_profile_notes(profile_notes)
            if notes_error:
                self._send_json(400, {'message': notes_error})
                return

            existing_score = existing['score']
            if payload.get('score') is None and existing_score is None:
                score = 0.0
            else:
                try:
                    score = float(payload.get('score', existing_score))
                except (TypeError, ValueError):
                    score = None

            if len(name) < 2:
                self._send_json(400, {'message': 'name must be at least 2 characters'})
                return

            if score is None or score < -5 or score > 5:
                self._send_json(400, {'message': 'score must be a number between -5 and 5'})
                return

            allowed_error = validate_allowed_rating_values(connection, {'category': category, 'selectedCriteria': payload.get('selectedCriteria', [])})
            if allowed_error:
                self._send_json(400, {'message': allowed_error})
                return

            connection.execute(
                '''
                UPDATE worker_profiles
                SET name = ?, job_category = ?, score = ?, reviewer = ?, notes = ?, rated_at = ?, profile_status = ?, background_info = ?, external_employee_id = ?, canonical_name = ?, canonical_worker_key = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (name, category, score, reviewer, note, rated_at, profile_status, background_info, external_employee_id, normalize_worker_name(name), key, int(profile_id)),
            )

            if payload.get('logRating') is True:
                connection.execute(
                    '''
                    INSERT INTO worker_ratings (worker_id, job_category, score, reviewer, notes, rated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (int(profile_id), category, score, reviewer, note, rated_at),
                )
                append_profile_history_entry(
                    connection,
                    int(profile_id),
                    category,
                    score,
                    f'Rating logged by {reviewer}' + (f': {note}' if note else ''),
                    rated_at,
                )

            replace_profile_history(connection, int(profile_id), history_entries)
            replace_profile_notes(connection, int(profile_id), profile_notes)

            row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (int(profile_id),)).fetchone()
            profile = build_profile(connection, row)

        publish_change_event('profiles_updated', {'profileId': int(profile_id), 'action': 'update_profile'})

        self._send_json(200, profile)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/profiles':
            with db_connection() as connection:
                connection.execute('DELETE FROM worker_profile_notes')
                connection.execute('DELETE FROM worker_profile_history')
                connection.execute('DELETE FROM worker_ratings')
                connection.execute('DELETE FROM worker_profiles')

            publish_change_event('profiles_updated', {'action': 'clear_all'})

            self._send_no_content()
            return

        segments = [segment for segment in path.split('/') if segment]
        if len(segments) == 3 and segments[0] == 'api' and segments[1] == 'profiles' and segments[2].isdigit():
            worker_id = int(segments[2])

            with db_connection() as connection:
                cursor = connection.execute('DELETE FROM worker_profiles WHERE id = ?', (worker_id,))
                if cursor.rowcount == 0:
                    self._send_json(404, {'message': 'Profile not found'})
                    return

            publish_change_event('profiles_updated', {'profileId': worker_id, 'action': 'delete_profile'})

            self._send_no_content()
            return

        if len(segments) == 5 and segments[0] == 'api' and segments[1] == 'profiles' and segments[2].isdigit() and segments[4].isdigit() and segments[3] in {'ratings', 'notes'}:
            worker_id = int(segments[2])
            entry_id = int(segments[4])

            with db_connection() as connection:
                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                if row is None:
                    self._send_json(404, {'message': 'Profile not found'})
                    return

                if segments[3] == 'ratings':
                    deleted = delete_rating(connection, worker_id, entry_id)
                else:
                    deleted = delete_profile_note(connection, worker_id, entry_id)

                if not deleted:
                    self._send_json(404, {'message': 'Entry not found'})
                    return

                row = connection.execute('SELECT * FROM worker_profiles WHERE id = ?', (worker_id,)).fetchone()
                profile = build_profile(connection, row)

            publish_change_event('profiles_updated', {'profileId': worker_id, 'action': f"delete_{segments[3][:-1]}"})

            self._send_json(200, profile)
            return

        self._send_json(404, {'message': 'Not found'})


if __name__ == '__main__':
    initialize_database()
    server = ThreadingHTTPServer((HOST, PORT), WorkerAPIHandler)
    print(f'Server listening on http://{HOST}:{PORT}')
    server.serve_forever()
