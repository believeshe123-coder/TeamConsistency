const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = path.join(__dirname, 'data.sqlite');

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) return reject(err);
    return resolve({ id: this.lastID, changes: this.changes });
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    return resolve(rows);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    return resolve(row);
  });
});

const init = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workerId INTEGER NOT NULL,
      date TEXT NOT NULL,
      jobCategory TEXT NOT NULL,
      overallScore REAL NOT NULL,
      late INTEGER NOT NULL DEFAULT 0,
      ncns INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(workerId) REFERENCES workers(id)
    )
  `);
};

app.get('/api/workers', async (_req, res) => {
  try {
    const rows = await all('SELECT id, name, createdAt FROM workers ORDER BY name COLLATE NOCASE ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to load workers' });
  }
});

app.post('/api/workers', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'name is required' });

    const existing = await get('SELECT id, name, createdAt FROM workers WHERE lower(name) = lower(?)', [name]);
    if (existing) return res.json(existing);

    const createdAt = new Date().toISOString();
    const result = await run('INSERT INTO workers(name, createdAt) VALUES(?, ?)', [name, createdAt]);
    const row = await get('SELECT id, name, createdAt FROM workers WHERE id = ?', [result.id]);
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to create worker' });
  }
});

app.get('/api/workers/:id/ratings', async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isInteger(workerId) || workerId <= 0) return res.status(400).json({ message: 'invalid worker id' });

    const rows = await all(
      `SELECT id, workerId, date, jobCategory, overallScore, late, ncns, notes, createdAt
       FROM ratings
       WHERE workerId = ?
       ORDER BY datetime(date) DESC, id DESC`,
      [workerId],
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to load ratings' });
  }
});

app.post('/api/ratings', async (req, res) => {
  try {
    const workerId = Number(req.body?.workerId);
    const date = String(req.body?.date || new Date().toISOString());
    const jobCategory = String(req.body?.jobCategory || '').trim();
    const overallScore = Number(req.body?.overallScore);
    const flags = req.body?.flags || {};
    const notes = String(req.body?.notes || '').trim();

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return res.status(400).json({ message: 'workerId is required' });
    }
    if (!jobCategory) return res.status(400).json({ message: 'jobCategory is required' });
    if (!Number.isFinite(overallScore)) return res.status(400).json({ message: 'overallScore must be a number' });

    const worker = await get('SELECT id FROM workers WHERE id = ?', [workerId]);
    if (!worker) return res.status(404).json({ message: 'worker not found' });

    const createdAt = new Date().toISOString();
    const late = flags.late ? 1 : 0;
    const ncns = flags.ncns ? 1 : 0;

    const result = await run(
      `INSERT INTO ratings(workerId, date, jobCategory, overallScore, late, ncns, notes, createdAt)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [workerId, date, jobCategory, overallScore, late, ncns, notes, createdAt],
    );

    const row = await get('SELECT id, workerId, date, jobCategory, overallScore, late, ncns, notes, createdAt FROM ratings WHERE id = ?', [result.id]);
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to create rating' });
  }
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
});
