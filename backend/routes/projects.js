const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all projects
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, COALESCE(SUM(b.gesamtsumme), 0) as gesamtsumme_total
    FROM projekte p
    LEFT JOIN belege b ON b.projekt_id = p.id
    GROUP BY p.id
    ORDER BY p.archiviert ASC, p.erstellt_am DESC
  `).all();
  res.json(projects);
});

// POST create project
router.post('/', (req, res) => {
  const { name, beschreibung } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
  const result = db.prepare(
    'INSERT INTO projekte (name, beschreibung) VALUES (?, ?)'
  ).run(name, beschreibung || null);
  const project = db.prepare('SELECT * FROM projekte WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// PUT update project
router.put('/:id', (req, res) => {
  const { name, beschreibung, archiviert } = req.body;
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM projekte WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  db.prepare(
    'UPDATE projekte SET name = ?, beschreibung = ?, archiviert = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    beschreibung !== undefined ? beschreibung : existing.beschreibung,
    archiviert !== undefined ? archiviert : existing.archiviert,
    id
  );
  const updated = db.prepare('SELECT * FROM projekte WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE project
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM projekte WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  db.prepare('DELETE FROM projekte WHERE id = ?').run(id);
  res.json({ message: 'Projekt gelöscht' });
});

module.exports = router;
