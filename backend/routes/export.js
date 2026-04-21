const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db');
const { buildWhereClause } = require('./receipts');

router.get('/excel', async (req, res) => {
  const { where, params } = buildWhereClause(req.query);

  const belege = db.prepare(`
    SELECT b.*, p.name as projekt_name
    FROM belege b
    LEFT JOIN projekte p ON p.id = b.projekt_id
    ${where}
    ORDER BY b.laufende_nummer ASC
  `).all(...params);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Beleg-Scanner';
  workbook.created = new Date();

  // Sheet 1: Übersicht
  const sheet1 = workbook.addWorksheet('Übersicht');
  sheet1.columns = [
    { header: 'Nr.', key: 'nr', width: 8 },
    { header: 'Datum', key: 'datum', width: 14 },
    { header: 'Markt', key: 'markt', width: 24 },
    { header: 'Kategorie', key: 'kategorie', width: 18 },
    { header: 'Projekt', key: 'projekt', width: 24 },
    { header: 'Gesamtsumme (€)', key: 'gesamtsumme', width: 18 }
  ];

  sheet1.getRow(1).font = { bold: true };
  sheet1.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF2C5F8A' }
  };
  sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let totalSum = 0;
  for (const b of belege) {
    sheet1.addRow({
      nr: b.laufende_nummer,
      datum: b.datum || '',
      markt: b.markt || '',
      kategorie: b.kategorie || '',
      projekt: b.projekt_name || '',
      gesamtsumme: b.gesamtsumme || 0
    });
    totalSum += b.gesamtsumme || 0;
  }

  // Total row
  const totalRow = sheet1.addRow({ nr: '', datum: '', markt: '', kategorie: '', projekt: 'Gesamt:', gesamtsumme: totalSum });
  totalRow.font = { bold: true };
  totalRow.getCell('gesamtsumme').numFmt = '#,##0.00 "€"';

  sheet1.getColumn('gesamtsumme').numFmt = '#,##0.00 "€"';

  // Sheet 2: Positionen
  const sheet2 = workbook.addWorksheet('Positionen');
  sheet2.columns = [
    { header: 'Beleg Nr.', key: 'beleg_nr', width: 12 },
    { header: 'Datum', key: 'datum', width: 14 },
    { header: 'Markt', key: 'markt', width: 24 },
    { header: 'Beschreibung', key: 'beschreibung', width: 32 },
    { header: 'Menge', key: 'menge', width: 10 },
    { header: 'Einzelpreis (€)', key: 'einzelpreis', width: 18 },
    { header: 'Gesamtpreis (€)', key: 'gesamtpreis', width: 18 }
  ];
  sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet2.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF2C5F8A' }
  };

  for (const b of belege) {
    const positionen = db.prepare('SELECT * FROM positionen WHERE beleg_id = ?').all(b.id);
    if (positionen.length === 0) {
      sheet2.addRow({
        beleg_nr: b.laufende_nummer,
        datum: b.datum || '',
        markt: b.markt || '',
        beschreibung: '(keine Positionen)',
        menge: '',
        einzelpreis: '',
        gesamtpreis: ''
      });
    } else {
      for (const pos of positionen) {
        sheet2.addRow({
          beleg_nr: b.laufende_nummer,
          datum: b.datum || '',
          markt: b.markt || '',
          beschreibung: pos.beschreibung || '',
          menge: pos.menge || 1,
          einzelpreis: pos.einzelpreis || 0,
          gesamtpreis: pos.gesamtpreis || 0
        });
      }
    }
  }

  sheet2.getColumn('einzelpreis').numFmt = '#,##0.00 "€"';
  sheet2.getColumn('gesamtpreis').numFmt = '#,##0.00 "€"';

  const filename = `Belege_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
