const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'beleg-scanner.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projekte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    beschreibung TEXT,
    archiviert INTEGER DEFAULT 0,
    erstellt_am TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS belege (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    laufende_nummer INTEGER,
    datum TEXT,
    markt TEXT,
    kategorie TEXT,
    gesamtsumme REAL,
    projekt_id INTEGER REFERENCES projekte(id),
    bild_pfad TEXT,
    erstellt_am TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS positionen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beleg_id INTEGER REFERENCES belege(id) ON DELETE CASCADE,
    beschreibung TEXT,
    menge REAL,
    einzelpreis REAL,
    gesamtpreis REAL
  );
`);

module.exports = db;
