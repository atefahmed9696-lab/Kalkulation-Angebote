const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { runOCR, parseReceiptText } = require('../ocr');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `scan_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function buildWhereClause(query) {
  const conditions = [];
  const params = [];
  if (query.projekt_id) { conditions.push('b.projekt_id = ?'); params.push(query.projekt_id); }
  if (query.kategorie) { conditions.push('b.kategorie = ?'); params.push(query.kategorie); }
  if (query.markt) { conditions.push('b.markt LIKE ?'); params.push(`%${query.markt}%`); }
  if (query.von) { conditions.push('b.datum >= ?'); params.push(query.von); }
  if (query.bis) { conditions.push('b.datum <= ?'); params.push(query.bis); }
  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

// GET all receipts with filters
router.get('/', (req, res) => {
  const { where, params } = buildWhereClause(req.query);
  const belege = db.prepare(`
    SELECT b.*, p.name as projekt_name
    FROM belege b
    LEFT JOIN projekte p ON p.id = b.projekt_id
    ${where}
    ORDER BY b.laufende_nummer DESC
  `).all(...params);

  const result = belege.map(b => ({
    ...b,
    positionen: db.prepare('SELECT * FROM positionen WHERE beleg_id = ?').all(b.id)
  }));
  res.json(result);
});

// GET single receipt
router.get('/:id', (req, res) => {
  const beleg = db.prepare(`
    SELECT b.*, p.name as projekt_name
    FROM belege b
    LEFT JOIN projekte p ON p.id = b.projekt_id
    WHERE b.id = ?
  `).get(req.params.id);
  if (!beleg) return res.status(404).json({ error: 'Beleg nicht gefunden' });
  beleg.positionen = db.prepare('SELECT * FROM positionen WHERE beleg_id = ?').all(beleg.id);
  res.json(beleg);
});

// POST scan image with OCR
router.post('/scan', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
  try {
    const text = await runOCR(req.file.path);
    const parsed = parseReceiptText(text);
    res.json({ ...parsed, bild_pfad: req.file.filename, raw_text: text });
  } catch (err) {
    console.error('OCR Fehler:', err);
    res.status(500).json({ error: 'OCR fehlgeschlagen', details: err.message });
  }
});

// POST create receipt
router.post('/', (req, res) => {
  const { datum, markt, kategorie, gesamtsumme, projekt_id, bild_pfad, positionen } = req.body;
  const maxRow = db.prepare('SELECT MAX(laufende_nummer) as max FROM belege').get();
  const laufende_nummer = (maxRow.max || 0) + 1;

  const result = db.prepare(`
    INSERT INTO belege (laufende_nummer, datum, markt, kategorie, gesamtsumme, projekt_id, bild_pfad)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(laufende_nummer, datum || null, markt || null, kategorie || null,
         gesamtsumme || null, projekt_id || null, bild_pfad || null);

  const belegId = result.lastInsertRowid;

  if (Array.isArray(positionen)) {
    const insertPos = db.prepare(
      'INSERT INTO positionen (beleg_id, beschreibung, menge, einzelpreis, gesamtpreis) VALUES (?, ?, ?, ?, ?)'
    );
    for (const pos of positionen) {
      insertPos.run(belegId, pos.beschreibung || null, pos.menge || null,
                    pos.einzelpreis || null, pos.gesamtpreis || null);
    }
  }

  const beleg = db.prepare(`
    SELECT b.*, p.name as projekt_name FROM belege b
    LEFT JOIN projekte p ON p.id = b.projekt_id WHERE b.id = ?
  `).get(belegId);
  beleg.positionen = db.prepare('SELECT * FROM positionen WHERE beleg_id = ?').all(belegId);
  res.status(201).json(beleg);
});

// PUT update receipt
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM belege WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Beleg nicht gefunden' });

  const { datum, markt, kategorie, gesamtsumme, projekt_id, bild_pfad, positionen } = req.body;

  db.prepare(`
    UPDATE belege SET datum=?, markt=?, kategorie=?, gesamtsumme=?, projekt_id=?, bild_pfad=?
    WHERE id=?
  `).run(
    datum ?? existing.datum,
    markt ?? existing.markt,
    kategorie ?? existing.kategorie,
    gesamtsumme ?? existing.gesamtsumme,
    projekt_id !== undefined ? projekt_id : existing.projekt_id,
    bild_pfad ?? existing.bild_pfad,
    id
  );

  if (Array.isArray(positionen)) {
    db.prepare('DELETE FROM positionen WHERE beleg_id = ?').run(id);
    const insertPos = db.prepare(
      'INSERT INTO positionen (beleg_id, beschreibung, menge, einzelpreis, gesamtpreis) VALUES (?, ?, ?, ?, ?)'
    );
    for (const pos of positionen) {
      insertPos.run(id, pos.beschreibung || null, pos.menge || null,
                    pos.einzelpreis || null, pos.gesamtpreis || null);
    }
  }

  const beleg = db.prepare(`
    SELECT b.*, p.name as projekt_name FROM belege b
    LEFT JOIN projekte p ON p.id = b.projekt_id WHERE b.id = ?
  `).get(id);
  beleg.positionen = db.prepare('SELECT * FROM positionen WHERE beleg_id = ?').all(id);
  res.json(beleg);
});

// DELETE receipt
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM belege WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Beleg nicht gefunden' });
  db.prepare('DELETE FROM belege WHERE id = ?').run(id);
  res.json({ message: 'Beleg gelöscht' });
});

module.exports = { router, buildWhereClause };
