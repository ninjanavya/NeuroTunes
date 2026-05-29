const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Database path
const dbDir = __dirname;
const dbPath = path.join(dbDir, process.env.DATABASE_FILE || 'neurotunes.db');

// Ensure database file directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to NeuroTunes SQLite Database at:', dbPath);
    initSchema();
  }
});

// Helper to run query with promise wrapper
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper to fetch all rows
function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper to fetch single row
function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Initialize tables
function initSchema() {
  db.serialize(() => {
    // 1. Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 2. Listening History table
    db.run(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        song_name TEXT NOT NULL,
        source TEXT DEFAULT 'local',
        mood TEXT,
        energy REAL,
        played_at TEXT NOT NULL
      )
    `);

    // 3. Mood History tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS mood_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        mood TEXT NOT NULL,
        valence REAL,
        arousal REAL,
        journal_text TEXT,
        logged_at TEXT NOT NULL
      )
    `);

    console.log('SQLite schemas verified / initialized successfully.');
  });
}

// User Actions
async function createUser(username, password) {
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const sql = `INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`;
  const result = await runQuery(sql, [username, hash, now]);
  return { id: result.id, username };
}

async function findUserByUsername(username) {
  const sql = `SELECT * FROM users WHERE username = ?`;
  return await getQuery(sql, [username]);
}

// Listening History Actions
async function addListeningHistory(userId, songName, source, mood, energy) {
  const now = new Date().toISOString();
  const sql = `INSERT INTO listening_history (user_id, song_name, source, mood, energy, played_at) VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await runQuery(sql, [userId, songName, source || 'youtube', mood || 'unknown', energy || 0.5, now]);
  return result.id;
}

async function getListeningHistory(userId, limit = 20) {
  const sql = `SELECT * FROM listening_history WHERE user_id = ? ORDER BY id DESC LIMIT ?`;
  return await allQuery(sql, [userId, limit]);
}

// Mood tracking Actions
async function addMoodHistory(userId, mood, valence, arousal, journalText) {
  const now = new Date().toISOString();
  const sql = `INSERT INTO mood_history (user_id, mood, valence, arousal, journal_text, logged_at) VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await runQuery(sql, [userId, mood, valence || 0.5, arousal || 0.5, journalText || '', now]);
  return result.id;
}

async function getMoodHistory(userId, limit = 30) {
  const sql = `SELECT * FROM mood_history WHERE user_id = ? ORDER BY id DESC LIMIT ?`;
  return await allQuery(sql, [userId, limit]);
}

module.exports = {
  db,
  createUser,
  findUserByUsername,
  addListeningHistory,
  getListeningHistory,
  addMoodHistory,
  getMoodHistory
};
