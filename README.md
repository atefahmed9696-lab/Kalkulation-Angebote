# Beleg-Scanner (Kalkulation-Angebote)

Eine vollständige Web-Applikation zum Scannen und Verwalten von Belegen/Quittungen für Bauprojekte.

## Features

- 📸 **OCR-Scan** – Belege per Foto scannen, Text automatisch erkennen (Datum, Markt, Summe, Positionen)
- 🧾 **Belegverwaltung** – Belege anlegen, bearbeiten, filtern und löschen
- 📁 **Projektzuordnung** – Belege Projekten zuordnen, Archivierung
- 📊 **Excel-Export** – Gefilterte Belege als .xlsx exportieren (Übersicht + Positionen)
- 🌐 **Responsive UI** – Funktioniert auf Desktop und Mobilgeräten

## Technologie-Stack

| Schicht   | Technologie                              |
|-----------|------------------------------------------|
| Backend   | Node.js, Express, SQLite (better-sqlite3) |
| OCR       | tesseract.js                             |
| Export    | exceljs                                  |
| Frontend  | React 18, Vite                           |
| Styling   | Plain CSS                                |

## Installation & Start

### Voraussetzungen
- Node.js 18+
- npm 9+

### Backend starten

```bash
cd backend
npm install
npm start
# Backend läuft auf http://localhost:3001
```

### Frontend starten (in einem zweiten Terminal)

```bash
cd frontend
npm install
npm run dev
# Frontend läuft auf http://localhost:5173
```

Anschließend die App im Browser unter **http://localhost:5173** öffnen.

## API-Übersicht

| Methode | Endpunkt                | Beschreibung                        |
|---------|-------------------------|-------------------------------------|
| GET     | /api/projects           | Alle Projekte abrufen               |
| POST    | /api/projects           | Neues Projekt anlegen               |
| PUT     | /api/projects/:id       | Projekt aktualisieren/archivieren   |
| DELETE  | /api/projects/:id       | Projekt löschen                     |
| GET     | /api/receipts           | Belege abrufen (mit Filtern)        |
| GET     | /api/receipts/:id       | Einzelnen Beleg abrufen             |
| POST    | /api/receipts/scan      | Bild scannen (OCR, nicht speichern) |
| POST    | /api/receipts           | Neuen Beleg speichern               |
| PUT     | /api/receipts/:id       | Beleg aktualisieren                 |
| DELETE  | /api/receipts/:id       | Beleg löschen                       |
| GET     | /api/export/excel       | Excel-Export (mit Filtern)          |

## Verzeichnisstruktur

```
/backend
  server.js          Express-Server (Port 3001)
  db.js              SQLite Schema & Initialisierung
  ocr.js             Tesseract OCR + Parsing-Logik
  routes/
    projects.js      CRUD für Projekte
    receipts.js      CRUD für Belege + OCR-Scan
    export.js        Excel-Export
  uploads/           Hochgeladene Belegfotos

/frontend
  vite.config.js     Vite-Konfiguration (Proxy → :3001)
  src/
    App.jsx           Haupt-App mit Tab-Navigation
    App.css           Globales Styling
    components/
      ReceiptList.jsx   Belegliste mit Filter & Accordion
      ReceiptForm.jsx   Scan-/Eingabeformular
      ProjectManager.jsx Projektverwaltung
```
