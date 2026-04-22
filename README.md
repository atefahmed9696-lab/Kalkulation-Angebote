# Kalkulation & Angebote – GU Sanierungsbetrieb

Eine webbasierte Kalkulationstabelle zur Angebotserstellung für einen Generalunternehmer (GU) Sanierungsbetrieb.

## Funktionen

- 📋 **Projektdaten** – Angebotsnummer, Datum, Kunde, Objekt, Bearbeiter
- ⚙️ **20 Gewerke-Tabs**, jedes mit eigener Positionstabelle:
  - ⚡ Elektro, 🔌 KNX Smart Home, 🚿 Sanitär, 🔥 Heizung, 🧱 Trockenbau, 🎨 Maler, 🪵 Boden, 🔷 Fliesen, 🚪 Türen, 🪟 Fenster, ⛏️ Abbruch, 🏗️ Rohbau, ⬛ Bodenplatte, 🏠 Dachdecker, 🪚 Zimmermann, 💨 Lüftung/Klima, 🚨 Brandmelde/Sicherheit, 🛗 Aufzüge/Förderanlagen, 🏗️ Gerüst, 🌿 Außenanlagen
- 📝 **Positionen** – Beschreibung, Einheit, Menge, Materialpreis, Stundensatz, Stunden → automatische Gesamtpreisberechnung
- 📋 **Musterpositionen** – vordefinierte typische Positionen je Gewerk mit einem Klick einfügen (basierend auf **BKI Baupreise G7 TGA, Q4/2024**)
- 📊 **Zusammenfassung** – Netto-, MwSt.- und Brutto-Gesamtbetrag über alle Gewerke
- 💾 **LocalStorage** – Daten bleiben nach Seitenreload erhalten
- 📤📥 **JSON-Export / -Import** – Kalkulationen abspeichern und laden
- 🖨️ **Drucken / PDF** – druckoptimierte Ansicht

## Preisbasis

Musterpositionen basieren auf **BKI Baupreise G7 – Technische Gebäudeausrüstung, 4. Quartal 2024** (Bundesdurchschnitt, netto). Enthaltene Leistungsbilder:
- **Heizung**: LB 040/041/042 – Gas-/Öl-Brennwert, Wärmepumpen (Luft/Sole/Wasser), BHKW, Pufferspeicher, Solarthermie, Erdsondenanlage
- **Sanitär**: LB 042/044/045/047 – Trinkwasser, Abwasser, Sanitärobjekte, Armaturen
- **Lüftung/Klima**: LB 075/375 – KWL-Lüftungsgeräte, Kältemaschinen, Split-Klimaanlagen, Kanalsystem
- **Brandmelde/Sicherheit**: LB 063 – BMZ, Melder, Signalgeber, Notruf (KG 450/456)
- **Aufzüge & Förderanlagen**: LB 069 – Personen-/Lastenaufzüge, Sitzlifte, Plattformlifte, Kleingüteraufzüge (KG 460/461)

## Verwendung

Einfach `index.html` im Browser öffnen – keine Installation oder Server nötig.
