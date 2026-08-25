/**
 * PriceCalculator.js – V2.9
 * Reine Logik, komplett getrennt von der 3D-Grafik / dem Renderer.
 * Preisbasis: BKI Baukosteninformationszentrum (Mittelwerte, Stand 2024).
 *
 * Architektur:
 *   Zustandsverwaltung (FloorPlanModel)
 *       ├── Renderer   → stellt Objekte visuell dar
 *       └── PriceCalculator → berechnet Kosten im Hintergrund
 */

// ── BKI-Preisdatenbank ────────────────────────────────────────────────────────
// Quelle: BKI Baukosten Gebäude / Positionen, jeweils Mittelwert €/Einheit (netto)
export const BKI_PRICE_DB = {

  /** Bodenbeläge €/m² (Material + Verlegung) */
  flooring: {
    fliesen:        { label: 'Bodenfliesen (Feinsteinzeug)', price: 65.00, unit: 'm²' },
    parkett:        { label: 'Parkett (Fertigparkett)',       price: 85.00, unit: 'm²' },
    laminat:        { label: 'Laminat (AC4)',                 price: 32.00, unit: 'm²' },
    teppich:        { label: 'Teppichboden (mittel)',         price: 28.00, unit: 'm²' },
    estrich:        { label: 'Zementestrich (60 mm)',         price: 22.00, unit: 'm²' },
    epoxid:         { label: 'Epoxidharz-Beschichtung',       price: 45.00, unit: 'm²' },
  },

  /** Wandbeläge / Malerarbeiten €/m² */
  walls: {
    maler:          { label: 'Malerarbeiten (2× streichen)',  price: 10.50, unit: 'm²' },
    tapete:         { label: 'Tapetenarbeiten inkl. Material',price: 14.00, unit: 'm²' },
    wandfliesen:    { label: 'Wandfliesen (Bad, Küche)',      price: 72.00, unit: 'm²' },
    putz:           { label: 'Innenputz (Gipsputz)',          price: 27.00, unit: 'm²' },
    trockenbau_bekleidung: { label: 'Trockenbau-Wandbekleidung', price: 38.00, unit: 'm²' },
    spachtel_q1:    { label: 'Spachtelung Q1 – Grundspachtelung',          price:  5.50, unit: 'm²' },
    spachtel_q2:    { label: 'Spachtelung Q2 – Standardspachtelung',       price:  9.80, unit: 'm²' },
    spachtel_q3:    { label: 'Spachtelung Q3 – Feinspachtelung',           price: 13.20, unit: 'm²' },
    spachtel_q4:    { label: 'Spachtelung Q4 – Höchste Güte (Metalliclack)',price: 21.00, unit: 'm²' },
    verspachteln:   { label: 'Verspachteln allgemein (Fugen, Risse, Anschlüsse)', price: 6.80, unit: 'm²' },
    verspachteln_vollfl: { label: 'Vollflächige Verspachtelung (Filztapete)', price: 11.50, unit: 'm²' },
  },

  /** Gipsarbeiten €/m² (BKI Gebäude G7 – Putz/Trockenbau) */
  gipsarbeiten: {
    gipsputz_masch:    { label: 'Innenputz Gipsputz maschinell einlagig 15 mm',  price: 27.00, unit: 'm²' },
    kalk_gipsputz:     { label: 'Kalk-Gipsputz 2-lagig 15 mm',                   price: 32.00, unit: 'm²' },
    gipsputz_gefilzt:  { label: 'Gipsputz gefilzt / geglättet (Sichtqualität)',  price: 36.00, unit: 'm²' },
    fermacell:         { label: 'Gipsfaserplatte Fermacell 12,5 mm auf UK',       price: 68.00, unit: 'm²' },
    gk_direktmontage:  { label: 'GK-Platte auf Massivwand Direktmontage',         price: 48.00, unit: 'm²' },
    glattputz:         { label: 'Glattputz Innen bis 5 mm (Flächenspachtel)',     price: 19.50, unit: 'm²' },
  },

  /** Deckenarbeiten €/m² */
  ceiling: {
    maler_decke:       { label: 'Decke streichen (2×)',                           price:  9.50, unit: 'm²' },
    abhaengdecke:      { label: 'Abgehängte GK-Decke',                            price: 42.00, unit: 'm²' },
    akustik:           { label: 'Akustikdecke (Mineralfaser)',                    price: 55.00, unit: 'm²' },
  },

  /** Wandsysteme Sonder – Trockenbau (BKI 2024) */
  wandsysteme: {
    doppelstaender:      { label: 'Doppelständerwand CW doppelt beplankt (erhöhter Schallschutz)', price: 128.00, unit: 'm²' },
    gis_installwand_m2:  { label: 'Sanitär-Installationswand GIS-System (UP-Spülkasten)',           price: 135.00, unit: 'm²' },
    ansetzbinder:        { label: 'Trockenputz / Ansetzbinder – GK direkt auf Mauerwerk',           price:  44.00, unit: 'm²' },
    strahlenschutz:      { label: 'Strahlenschutzwand blei-kaschierte Gipsplatte (Röntgenraum)',    price: 185.00, unit: 'm²' },
    rundwand:            { label: 'Gebogene Wand / Rundwand Sonderkonstruktion GK',                 price: 145.00, unit: 'm²' },
    gips_wandbauplatte:  { label: 'Gips-Wandbauplatte (Vollgips, Nut+Feder, z. B. MultiGips)',     price:  52.00, unit: 'm²' },
  },

  /** Deckensysteme Sonder – Trockenbau (BKI 2024) */
  deckensysteme: {
    rasterdecke:         { label: 'Rasterdecke / OWA-Einlegedecke T-Schienen + Mineralfaserplatten', price:  62.00, unit: 'm²' },
    lamellendecke:       { label: 'Lamellendecke / Baffeldecke Metall/Holz offen',                   price:  95.00, unit: 'm'  },
    dachgeschoss:        { label: 'Dachgeschossbekleidung Schräge inkl. Dampfbremse/Klimamembran',    price:  78.00, unit: 'm²' },
  },

  /** Design-Trockenbau, Formteile & Lichtvouuten (BKI 2024) */
  design: {
    lichtvoute:          { label: 'Lichtvoute / LED-Profil abgestufte Decken-/Wandnische',          price:  85.00, unit: 'm'  },
    deckensegel:         { label: 'Deckensegel freihängend (rund/eckig/frei)',                       price: 185.00, unit: 'Stk'},
    biegeformteil:       { label: 'Falt-/Biegetechnik-Formteil GK gefräst 90°-Kante/L/U',          price:  38.00, unit: 'm'  },
    schattenfuge:        { label: 'Schattenfugenprofil Alu Wand-/Deckenübergang',                    price:  22.00, unit: 'm'  },
    vorhangtasche:       { label: 'Vorhangtasche / Gardinenblende in Decke integriert',              price:  68.00, unit: 'm'  },
    saulenverkleidung:   { label: 'Säulen-/Bogenverkleidung Halbschale rund',                       price: 125.00, unit: 'm'  },
    nischenregal:        { label: 'Nischen- und Regaleinbau in Trockenbaukonstruktion',              price: 285.00, unit: 'Stk'},
  },

  /** Innenputzarbeiten Sonder – Gips, Kalk & Zement (BKI 2024) */
  innenputz: {
    gips_q1:             { label: 'Gips-Innenputz Q1 – abgezogen (z. B. MP 75)',                    price:  19.00, unit: 'm²' },
    gips_q2:             { label: 'Gips-Innenputz Q2 – Standard (maschinell)',                      price:  27.00, unit: 'm²' },
    gips_q3:             { label: 'Gips-Innenputz Q3 – gefilzt / feingeglättet',                    price:  36.00, unit: 'm²' },
    gips_q4:             { label: 'Gips-Innenputz Q4 – vollflächig gespachtelt (Höchstqualität)',   price:  48.00, unit: 'm²' },
    kalk_zement:         { label: 'Kalk-Zement-Putz feuchtigkeitsbeständig (Bad/Keller/Garage)',    price:  35.00, unit: 'm²' },
    sanierputz:          { label: 'Sanierputz (Sackware) für feuchtes/salzbelastetes Mauerwerk',    price:  52.00, unit: 'm²' },
    lehmputz:            { label: 'Lehmputz ökologisch mehrlagig mit Armierungsgewebe',             price:  48.00, unit: 'm²' },
    duennlagenputz:      { label: 'Dünnlagenputz / Spachtelputz 2–5 mm (Beton/Porenbeton)',         price:  19.50, unit: 'm²' },
    eckschutzschiene:    { label: 'Eckschutzschiene setzen (Alu/verzinkt, Fensterecken/Kanten)',    price:   8.50, unit: 'm'  },
    apu_leiste:          { label: 'APU-Anputzleiste Fenster-/Türrahmen schlagregendicht',           price:   7.20, unit: 'm'  },
  },

  /** Außenputzarbeiten & Fassadenkonstruktion (BKI 2024) */
  aussenputz: {
    unterputz_leicht:    { label: 'Unterputz Leichtunterputz Außen 1. Schicht',                     price:  18.00, unit: 'm²' },
    armierungsputz:      { label: 'Armierungsputz mit Glasfasergewebe-Einlage',                     price:  28.00, unit: 'm²' },
    oberputz_mineral:    { label: 'Mineralischer Oberputz (Scheiben-/Kratzer-/Rillenputz)',          price:  24.00, unit: 'm²' },
    oberputz_pastoes:    { label: 'Pastöser Oberputz Silikonharz-/Silikat-/Kunstharzbasis',         price:  32.00, unit: 'm²' },
    buntsteinputz:       { label: 'Buntsteinputz / Mosaikputz Fassadensockel',                      price:  45.00, unit: 'm²' },
    waermedaemmputz:     { label: 'Wärmedämmputz (Styroporkügelchen-Zuschlag)',                     price:  38.00, unit: 'm²' },
    fassadenprofil:      { label: 'Fassaden-Profilleiste / Stuckprofil EPS aufgeklebt',             price:  28.00, unit: 'm'  },
    sockelprofil:        { label: 'Sockelprofil / Tropfkantenleiste Fassaden-Startleiste',          price:  12.00, unit: 'm'  },
  },

  /** Bodensysteme im Trockenbau (BKI 2024) */
  bodentrockenbau: {
    trockenestrich_eps:  { label: 'Trockenestrich mit EPS/MF-Kaschierung (werkseitig gedämmt)',    price:  82.00, unit: 'm²' },
    schüttung:           { label: 'Ausgleichsschüttung / Trockenschüttung (Ton/Perlite-Granulat)', price:  28.00, unit: 'm²' },
    doppelboden:         { label: 'Hohlraumboden / Doppelboden auf Metallfüßen (Büro)',             price:  88.00, unit: 'm²' },
  },

  /** Anschlüsse, Spachtelung & Zubehör (BKI 2024) */
  zubehör: {
    fugenverspachtelung: { label: 'Fugenverspachtelung Plattenstöße mit Bewehrungsstreifen',        price:   4.80, unit: 'm'  },
    anschlussfuge:       { label: 'Anschlussfuge elastisch Acryl/Silikon Bauteilübergang',          price:   6.50, unit: 'm'  },
    trennwandband:       { label: 'Trennwandband / Entkopplung Schaumstoff unter Anschlussprofil', price:   3.20, unit: 'm'  },
    revisionsklappe:     { label: 'Revisionsklappe einbauen flächenbündig (auch feuerh./luftd.)',   price: 145.00, unit: 'Stk'},
    ua_profil:           { label: 'UA-Profil Türsturz 2 mm Stahl (schwere Türöffnung)',            price:  42.00, unit: 'm'  },
  },

  /** Einzelpositionen (Einheitspreis) */
  items: {
    door:           { label: 'Innentür (CPL, inkl. Zarge)',   price: 485.00, unit: 'Stk' },
    window:         { label: 'Fenster (Kunststoff, 2-fach)',   price: 420.00, unit: 'lfm' },
    wall_lfm:       { label: 'Trennwand / Wand',              price:  85.00, unit: 'lfm' },
    radiator:       { label: 'Flachheizkörper',               price: 390.00, unit: 'Stk' },
    socket:         { label: 'Schutzkontaktsteckdose UP',      price:  42.00, unit: 'Stk' },
    switch:         { label: 'Wechselschalter UP',             price:  40.00, unit: 'Stk' },
    lamp:           { label: 'LED-Deckenleuchte',              price: 155.00, unit: 'Stk' },
    wc:             { label: 'WC-Anlage montieren',            price: 285.00, unit: 'Stk' },
    shower:         { label: 'Dusche Unterputz-Thermostat',    price: 485.00, unit: 'Stk' },
    bathtub:        { label: 'Badewanne montieren',            price: 569.00, unit: 'Stk' },
    sink:           { label: 'Waschtisch montieren',           price: 464.00, unit: 'Stk' },
  },

  /** Material-Multiplikatoren (z.B. Aufschlag Naturstein) */
  materialMultiplier: {
    standard:   1.00,
    premium:    1.45,
    budget:     0.70,
    naturstein: 1.80,
  },
};

// ── PriceCalculator ───────────────────────────────────────────────────────────
export class PriceCalculator {
  /**
   * @param {object} priceDb – Preisdatenbank (Standard: BKI_PRICE_DB)
   * @param {number} roomHeight – Raumhöhe in Metern (Standard: 2.5 m)
   */
  constructor(priceDb = BKI_PRICE_DB, roomHeight = 2.5) {
    this.db = priceDb;
    this.roomHeight = roomHeight;
  }

  // ── 1. Bodenbelag-Kosten (nach Raumfläche) ────────────────────────────────
  /**
   * @param {Array} rooms – Array von Raum-Objekten { area, flooringType? }
   * @param {string} defaultType – Bodenbelagstyp wenn kein Typ am Raum gesetzt
   */
  calculateFlooringCost(rooms, defaultType = 'fliesen') {
    return rooms.reduce((total, room) => {
      const type   = room.flooringType || defaultType;
      const entry  = this.db.flooring[type] || this.db.flooring.fliesen;
      const area   = room.area || 0;
      return total + area * entry.price;
    }, 0);
  }

  // ── 2. Wandflächen-Kosten (Umfang × Höhe – Öffnungen) ───────────────────
  /**
   * @param {Array} walls    – Wall-Objekte { start, end }
   * @param {Array} openings – Opening-Objekte { width, height?, type }
   * @param {string} wallType – Wandbelagstyp aus db.walls
   */
  calculateWallSurfaceCost(walls, openings = [], wallType = 'maler') {
    const entry = this.db.walls[wallType] || this.db.walls.maler;
    // Gesamte Wandlänge
    const totalLen = walls.reduce((s, w) => {
      if (!w.start || !w.end) return s;
      return s + Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
    }, 0);
    // Öffnungsfläche abziehen
    const openingArea = openings.reduce((s, o) => {
      return s + (o.width || 0.9) * (o.height || 2.1);
    }, 0);
    const wallArea = Math.max(0, totalLen * this.roomHeight - openingArea);
    return { cost: wallArea * entry.price, area: parseFloat(wallArea.toFixed(2)) };
  }

  // ── 3. Decken-Kosten (= Summe aller Raumflächen) ─────────────────────────
  calculateCeilingCost(rooms, ceilingType = 'maler_decke') {
    const entry = this.db.ceiling[ceilingType] || this.db.ceiling.maler_decke;
    const area  = rooms.reduce((s, r) => s + (r.area || 0), 0);
    return { cost: area * entry.price, area: parseFloat(area.toFixed(2)) };
  }

  // ── 4. Möbel / Einzel-Items ───────────────────────────────────────────────
  calculateItemsCost(placedItems) {
    return placedItems.reduce((total, item) => {
      const entry = this.db.items[item.catalogId || item.id];
      if (!entry) return total;
      const multiplier = this.db.materialMultiplier[item.material] || 1.0;
      return total + entry.price * (item.count || 1) * multiplier;
    }, 0);
  }

  // ── 5. Vollständige Kalkulation ───────────────────────────────────────────
  /**
   * Gibt eine vollständige Positionsliste zurück, die direkt in den
   * Kalkulations-Import übernommen werden kann.
   *
   * @param {object} state – FloorPlanModel.getSerializableState()
   * @param {object} options – { flooringType, wallType, ceilingType, includeRoomCosts }
   */
  generatePositions(state, options = {}) {
    if (!state || !state.floors) return [];

    const {
      flooringType   = 'fliesen',
      wallType       = 'maler',
      ceilingType    = 'maler_decke',
      includeRoomCosts = true,
    } = options;

    const allWalls    = state.floors.flatMap(f => f.walls    || []);
    const allOpenings = state.floors.flatMap(f => f.openings || []);
    const allObjects  = state.floors.flatMap(f => f.objects  || []);
    const allRooms    = state.floors.flatMap(f => f.rooms    || []);

    const positions = [];

    // ── Wände lfm
    const wallLen = allWalls.reduce((s, w) => {
      if (!w.start || !w.end) return s;
      return s + Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
    }, 0);
    if (wallLen > 0.5) {
      positions.push({
        gewerk: 'trockenbau',
        beschreibung: `${this.db.items.wall_lfm.label} (aus Grundriss)`,
        einheit: 'lfm',
        menge: parseFloat(wallLen.toFixed(2)),
        materialpreis: this.db.items.wall_lfm.price,
        stunden: 0,
      });
    }

    // ── Türen
    const nDoor = allOpenings.filter(o => o.type === 'door').length;
    if (nDoor > 0) {
      positions.push({
        gewerk: 'tueren',
        beschreibung: `${this.db.items.door.label} (aus Grundriss)`,
        einheit: 'Stk',
        menge: nDoor,
        materialpreis: this.db.items.door.price,
        stunden: 0,
      });
    }

    // ── Fenster
    const windows = allOpenings.filter(o => o.type === 'window');
    if (windows.length > 0) {
      const totalWinW = windows.reduce((s, o) => s + (o.width || 0.9), 0);
      positions.push({
        gewerk: 'fenster',
        beschreibung: `${this.db.items.window.label} (aus Grundriss)`,
        einheit: 'lfm',
        menge: parseFloat(totalWinW.toFixed(2)),
        materialpreis: this.db.items.window.price,
        stunden: 0,
      });
    }

    // ── Raum-basierte Kosten (Boden, Wand, Decke)
    if (includeRoomCosts && allRooms.length > 0) {
      const totalArea = allRooms.reduce((s, r) => s + (r.area || 0), 0);

      // Bodenbelag
      if (totalArea > 0.5) {
        const floorEntry = this.db.flooring[flooringType] || this.db.flooring.fliesen;
        positions.push({
          gewerk: 'boden',
          beschreibung: `${floorEntry.label} (aus Grundriss, ${totalArea.toFixed(1)} m²)`,
          einheit: 'm²',
          menge: parseFloat(totalArea.toFixed(2)),
          materialpreis: floorEntry.price,
          stunden: 0,
        });
      }

      // Wandfläche Malerarbeiten
      const { cost: wallCost, area: wallArea } = this.calculateWallSurfaceCost(allWalls, allOpenings, wallType);
      if (wallArea > 1) {
        const wallEntry = this.db.walls[wallType] || this.db.walls.maler;
        positions.push({
          gewerk: 'maler',
          beschreibung: `${wallEntry.label} Wände (aus Grundriss, ${wallArea} m²)`,
          einheit: 'm²',
          menge: wallArea,
          materialpreis: wallEntry.price,
          stunden: 0,
        });
      }

      // Deckenfläche
      const { area: ceilArea } = this.calculateCeilingCost(allRooms, ceilingType);
      if (ceilArea > 0.5) {
        const ceilEntry = this.db.ceiling[ceilingType] || this.db.ceiling.maler_decke;
        positions.push({
          gewerk: 'maler',
          beschreibung: `${ceilEntry.label} Decken (aus Grundriss, ${ceilArea} m²)`,
          einheit: 'm²',
          menge: ceilArea,
          materialpreis: ceilEntry.price,
          stunden: 0,
        });
      }
    }

    // ── Elektro
    const elektroMap = {
      socket: { gewerk: 'elektro', key: 'socket' },
      switch: { gewerk: 'elektro', key: 'switch' },
      lamp:   { gewerk: 'elektro', key: 'lamp'   },
    };
    for (const [catalogId, cfg] of Object.entries(elektroMap)) {
      const n = allObjects.filter(o => o.layer === 'electrical' && o.catalogId === catalogId).length;
      if (n > 0) {
        const entry = this.db.items[cfg.key];
        positions.push({
          gewerk: cfg.gewerk,
          beschreibung: `${entry.label} (aus Grundriss)`,
          einheit: 'Stk',
          menge: n,
          materialpreis: entry.price,
          stunden: 0,
        });
      }
    }

    // ── Sanitär
    const sanitaerMap = ['wc', 'shower', 'bathtub', 'sink'];
    for (const catalogId of sanitaerMap) {
      const n = allObjects.filter(o => o.layer === 'sanitary' && o.catalogId === catalogId).length;
      if (n > 0) {
        const entry = this.db.items[catalogId];
        positions.push({
          gewerk: 'sanitaer',
          beschreibung: `${entry.label} (aus Grundriss)`,
          einheit: 'Stk',
          menge: n,
          materialpreis: entry.price,
          stunden: 0,
        });
      }
    }

    // ── Heizung
    const nHk = allObjects.filter(o => o.layer === 'heating' && o.catalogId === 'radiator').length;
    if (nHk > 0) {
      const entry = this.db.items.radiator;
      positions.push({
        gewerk: 'heizung',
        beschreibung: `${entry.label} (aus Grundriss)`,
        einheit: 'Stk',
        menge: nHk,
        materialpreis: entry.price,
        stunden: 0,
      });
    }

    return positions;
  }

  // ── 6. Rechnung mit MwSt. und Rabatt ─────────────────────────────────────
  generateInvoice(positions, stundensatz = 65, discountCode = '') {
    const subtotal = positions.reduce((s, p) => {
      const mat   = (p.materialpreis || 0) * (p.menge || 0);
      const arbeit = (p.stunden || 0) * stundensatz;
      return s + mat + arbeit;
    }, 0);

    const discount = discountCode === 'PROFI10' ? subtotal * 0.10 : 0;
    const total = subtotal - discount;
    const tax   = total * 0.19;

    return {
      subtotal:  parseFloat(subtotal.toFixed(2)),
      discount:  parseFloat(discount.toFixed(2)),
      tax:       parseFloat(tax.toFixed(2)),
      total:     parseFloat((total + tax).toFixed(2)),
    };
  }
}
