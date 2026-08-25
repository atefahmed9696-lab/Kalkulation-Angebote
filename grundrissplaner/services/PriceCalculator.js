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

  /** Abbruch- & Rückbauarbeiten €/Einheit – BKI Mittelwerte netto 2024 */
  abbruch: {
    // Baustelleneinrichtung & Schutz
    baustelle_einrichten:   { label: 'Baustelleneinrichtung inkl. Entsorgungslogistik',     price: 420.00, unit: 'Pauschal' },
    staubschutzwand:        { label: 'Staubschutzwand PE-Folie auf Ständer aufstellen',     price:  15.00, unit: 'm²'      },
    bodenabdeckung:         { label: 'Bodenabdeckung Schutzpappe / Folie',                  price:   3.20, unit: 'm²'      },
    containerstellung_7m3:  { label: 'Containerstellung 7 m³ inkl. Abholung',               price: 320.00, unit: 'Stk'     },
    schadstoffpruefung:     { label: 'Schadstoffprüfung Asbest/KMF/PCB inkl. Laborbericht', price: 480.00, unit: 'Pauschal' },
    // Tapeten & Wandoberflächen
    tapete:                 { label: 'Tapeten entfernen inkl. Kleisterreste',                price:   4.50, unit: 'm²'      },
    raufaser:               { label: 'Raufasertapete entfernen',                             price:   5.50, unit: 'm²'      },
    glasfasergewebe:        { label: 'Glasfasergewebe entfernen',                            price:   7.80, unit: 'm²'      },
    farbanstrich_entf:      { label: 'Farbanstriche abschleifen / entfernen',                price:  10.00, unit: 'm²'      },
    gipsputz_abschlagen:    { label: 'Gipsputz an Wänden abschlagen',                        price:  15.00, unit: 'm²'      },
    kzputz_abschlagen:      { label: 'Kalk-Zement-Putz abschlagen',                         price:  18.00, unit: 'm²'      },
    deckenputz_abschlagen:  { label: 'Innenputz an Decken abschlagen',                       price:  20.00, unit: 'm²'      },
    wandfliesen_abbruch:    { label: 'Wandfliesen inkl. Kleber abstemmen',                   price:  22.00, unit: 'm²'      },
    holzverkleidung_entf:   { label: 'Holzverkleidung / Paneele Wand demontieren',           price:  12.50, unit: 'm²'      },
    abhaengdecke_demontage: { label: 'Abgehängte GK-Decke demontieren',                      price:  16.00, unit: 'm²'      },
    deckenverkleidung_entf: { label: 'Deckenverkleidung Holz / Paneele demontieren',         price:  14.00, unit: 'm²'      },
    // Bodenbeläge
    teppich_aufnehmen:      { label: 'Teppichboden aufnehmen inkl. Nagelleisten',            price:   4.00, unit: 'm²'      },
    pvc_linoleum_entf:      { label: 'PVC / Linoleum aufnehmen inkl. Klebereste',            price:   7.00, unit: 'm²'      },
    laminat_aufnehmen:      { label: 'Laminat aufnehmen',                                    price:   5.50, unit: 'm²'      },
    parkett_aufnehmen:      { label: 'Parkett ausbauen inkl. Klebereste',                    price:  11.00, unit: 'm²'      },
    dielenboden_aufnehmen:  { label: 'Dielenboden aufnehmen',                                price:  12.50, unit: 'm²'      },
    vinyl_entf:             { label: 'Vinylboden / Designbelag entfernen',                   price:   6.50, unit: 'm²'      },
    sockelleisten_entf:     { label: 'Sockelleisten demontieren',                            price:   3.80, unit: 'm'       },
    kleberreste_entf:       { label: 'Kleberreste auf Untergrund beseitigen',                price:   8.50, unit: 'm²'      },
    // Fliesen & Naturstein
    bodenfliesen_abbruch:   { label: 'Bodenfliesen inkl. Kleber abbrechen',                  price:  20.00, unit: 'm²'      },
    fliesenkleber_entf:     { label: 'Fliesenkleber nach Fliesenabbruch entfernen',          price:  14.00, unit: 'm²'      },
    naturstein_aufnehmen:   { label: 'Natursteinbelag aufnehmen',                            price:  28.00, unit: 'm²'      },
    mosaik_entf:            { label: 'Mosaikfliesen entfernen',                              price:  22.00, unit: 'm²'      },
    // Estrich & Bodenaufbau
    zementestrich_abbruch:  { label: 'Zementestrich abbrechen bis 60 mm',                   price:  22.00, unit: 'm²'      },
    anhydritestrich_abbruch:{ label: 'Anhydritestrich abbrechen',                            price:  25.00, unit: 'm²'      },
    schwimmestrich_abbruch: { label: 'Schwimmenden Estrich inkl. Trennlage aufnehmen',       price:  28.00, unit: 'm²'      },
    daemmung_ausbauen:      { label: 'Dämmung unter Estrich ausbauen',                       price:  10.00, unit: 'm²'      },
    fbh_rueckbau:           { label: 'Fußbodenheizung rückbauen inkl. Heizkreisverteiler',   price:  28.00, unit: 'm²'      },
    // Nichttragende Wände
    gkwand_demontage:       { label: 'Gipskarton-Ständerwand demontieren',                   price:  18.00, unit: 'm²'      },
    mauerwerk_abbruch_nit:  { label: 'Nichttragende Innenwand Mauerwerk abbrechen',          price:  38.00, unit: 'm²'      },
    vorsatzschale_abbruch:  { label: 'Vorsatzschale / Vorwandinstallation rückbauen',        price:  16.50, unit: 'm²'      },
    // Durchbrüche
    tuerdurcbruch:          { label: 'Türdurchbruch Mauerwerk herstellen inkl. Sturz',       price: 250.00, unit: 'Stk'     },
    kernbohrung:            { label: 'Kernbohrung Ø 68–132 mm für Rohrdurchführung',         price: 110.00, unit: 'Stk'     },
    wandschlitz_50:         { label: 'Wandschlitz bis 50 mm Breite herstellen',              price:  22.00, unit: 'm'       },
    // Türen & Einbauten
    innentuer_ausbauen:     { label: 'Innentür ausbauen',                                    price:  35.00, unit: 'Stk'     },
    holzzarge_ausbauen:     { label: 'Holzzarge ausbauen',                                   price:  45.00, unit: 'Stk'     },
    stahlzarge_ausbauen:    { label: 'Stahlzarge ausflexen / ausbauen',                      price:  65.00, unit: 'Stk'     },
    einbauschrank_ausbauen: { label: 'Einbauschrank demontieren',                            price:  60.00, unit: 'Stk'     },
    // Fenster
    fenster_ausbauen:       { label: 'Fenster ausbauen',                                     price:  75.00, unit: 'Stk'     },
    rollladen_demontage:    { label: 'Rollläden demontieren',                                 price:  50.00, unit: 'Stk'     },
    // Sanitär
    wc_demontage:           { label: 'WC demontieren inkl. Spülkasten',                      price:  70.00, unit: 'Stk'     },
    waschbecken_ausbauen:   { label: 'Waschbecken ausbauen',                                 price:  60.00, unit: 'Stk'     },
    badewanne_ausbauen:     { label: 'Badewanne ausbauen',                                   price:  85.00, unit: 'Stk'     },
    duschtasse_ausbauen:    { label: 'Duschtasse entfernen',                                 price:  70.00, unit: 'Stk'     },
    vorwand_rueckbau:       { label: 'Vorwandinstallation / GIS-Element rückbauen',          price: 110.00, unit: 'Stk'     },
    // Heizung
    heizkoerper_demontage:  { label: 'Heizkörper demontieren',                               price:  70.00, unit: 'Stk'     },
    heizrohr_stilllegen:    { label: 'Heizungsrohre stilllegen / rückbauen',                 price:  18.00, unit: 'm'       },
    // Elektro
    elektro_stilllegen:     { label: 'Elektroinstallationen spannungsfrei schalten',         price: 180.00, unit: 'Pauschal' },
    steckdose_demontage:    { label: 'Schalter / Steckdose demontieren',                     price:  12.00, unit: 'Stk'     },
    leuchte_demontage:      { label: 'Leuchte / Deckenauslass demontieren',                  price:  18.00, unit: 'Stk'     },
    kabel_ausbauen:         { label: 'Kabel / Leitungen ausbauen',                           price:   4.50, unit: 'm'       },
    // Küche
    einbaukueche_demontage: { label: 'Einbauküche komplett demontieren',                     price: 450.00, unit: 'Pauschal' },
    // Bad entkernen
    bad_entkernen:          { label: 'Bad komplett entkernen (alle Gewerke)',                 price: 110.00, unit: 'm²'      },
    // Entsorgung
    schutt_transport_innen: { label: 'Bauschutt intern transportieren zur Ladestelle',       price:  22.00, unit: 'm³'      },
    bauschutt_entsorgung:   { label: 'Mineralischen Bauschutt laden + entsorgen inkl. Deponie', price: 38.00, unit: 't'    },
    baumischabfall:         { label: 'Baumischabfall entsorgen (AVV 170904)',                 price: 145.00, unit: 't'      },
    holz_entsorgung:        { label: 'Holzabfälle entsorgen',                                price: 110.00, unit: 't'      },
    gips_entsorgung:        { label: 'Gipshaltige Baustoffe sortenrein entsorgen',           price: 140.00, unit: 't'      },
    fliesen_entsorgung:     { label: 'Fliesen- / Keramikschutt entsorgen',                   price:  75.00, unit: 't'      },
    containerstellung_10m3: { label: 'Containerstellung 10 m³ inkl. Abholung',               price: 395.00, unit: 'Stk'    },
    besenrein:              { label: 'Baustelle / Wohnung besenrein übergeben',               price: 185.00, unit: 'Pauschal'},
    // Schadstoffpositionen
    asbest_probenahme:      { label: 'Asbestprobenahme und Laboranalyse',                    price: 160.00, unit: 'Stk'    },
    asbest_entfernen:       { label: 'Asbesthaltige Materialien fachgerecht ausbauen (TRGS 519)', price: 85.00, unit: 'm²' },
    floor_flex_entf:        { label: 'Floor-Flex-Platten (PAK-haltig) gesondert ausbauen',   price: 115.00, unit: 'm²'     },
    kmf_entsorgung:         { label: 'KMF / Mineralwolle-Altdämmung gesondert entsorgen',    price:  25.00, unit: 'm²'     },
    sonderabfall_entsorg:   { label: 'Schadstoffhaltige Baustoffe als Sonderabfall entsorgen', price: 650.00, unit: 't'   },
  },

  /** Abdichtungsarbeiten €/Einheit – BKI Mittelwerte netto 2024 (KG 352–354) */
  abdichtung: {
    // Untergrundvorbereitung
    untergrundvorbereitung:  { label: 'Untergrundvorbereitung Fassade / Keller reinigen',        price:   8.50, unit: 'm²' },
    bitumen_voranstrich:     { label: 'Bitumen-Voranstrich (Primer) kalt aufbringen',            price:   4.80, unit: 'm²' },
    hohlkehle:               { label: 'Hohlkehle Dichtmörtel Wand-Boden-Übergang',              price:  14.00, unit: 'm'  },
    // Kellerabdichtung Außen
    kmb_dickbeschichtung:    { label: 'Bitumen-Dickbeschichtung (KMB) 2-lagig',                 price:  45.00, unit: 'm²' },
    schweisskette_2lag:      { label: 'Bitumen-Schweißbahn V60 S4 2-lagig Kelleraußenwand',     price:  52.00, unit: 'm²' },
    kunststoff_dichtbahn:    { label: 'Kunststoff-Dichtungsbahn HDPE 2mm',                      price:  62.00, unit: 'm²' },
    perimeterdaemm_80:       { label: 'Perimeterdämmung XPS 80mm (Keller / Sockel)',            price:  44.00, unit: 'm²' },
    perimeterdaemm_120:      { label: 'Perimeterdämmung XPS 120mm',                             price:  58.00, unit: 'm²' },
    schutzplatte_pe:         { label: 'Schutzplatte PE profiliert als Schutzlage',              price:   8.50, unit: 'm²' },
    // Kellerabdichtung Innen / Sanierputz
    dichtschlaemme_2lag:     { label: 'Dichtschlämme mineralisch 2-lagig 5mm',                  price:  28.00, unit: 'm²' },
    sperrputz:               { label: 'Sperrputz sulfatbeständig 20mm (drückendes Wasser)',     price:  42.00, unit: 'm²' },
    sanierputzsystem_wta:    { label: 'Sanierputzsystem WTA 3-lagig (Sackware)',                price:  68.00, unit: 'm²' },
    horizontalsperre_inj:    { label: 'Horizontalsperre durch Injektion (je m Wandlänge)',      price:  85.00, unit: 'm'  },
    // Nassbereichsabdichtung
    fluessigabdichtung_2lag: { label: 'Flüssigabdichtung 2-lagig DIN 18534 (Bad / Dusche)',    price:  35.00, unit: 'm²' },
    fluessigabdichtung_voll: { label: 'Flüssigabdichtung 2-lagig vollflächig Bad',             price:  40.00, unit: 'm²' },
    dichtband:               { label: 'Dichtband Wand-Boden-Anschluss',                         price:  12.00, unit: 'm'  },
    rohrmanschette:          { label: 'Rohrdurchführungs-Dichtmanschette',                       price:  28.00, unit: 'Stk'},
    // Balkon-/Terrassenabdichtung
    fluessigkunststoff_balk: { label: 'Flüssigkunststoff-Abdichtung Balkon 2-lagig',            price:  48.00, unit: 'm²' },
    bitumenbahn_balkon:      { label: 'Bitumendachbahn V60 S4 zweilagig Balkon',               price:  40.00, unit: 'm²' },
    entkopplungsmatte:       { label: 'Entkopplungsmatte / Dränschutzplatte Balkon',            price:  18.00, unit: 'm²' },
    terrassenablauf:         { label: 'Ablauftopf / Terrassenablauf DN100 einbauen',            price: 185.00, unit: 'Stk'},
    // Drainage
    noppenbahn:              { label: 'Noppenbahn HDPE 0,5mm inkl. Filtervlies',               price:  12.00, unit: 'm²' },
    drainmatte:              { label: 'Drainmatte 20mm mit Filtervlies',                        price:  18.00, unit: 'm²' },
    drainrohr_dn100:         { label: 'Drainrohr PE gelocht DN100 inkl. Filtervliesmanschette', price:  22.00, unit: 'm'  },
    filterkies:              { label: 'Filterkies 8/16mm Drainschicht',                         price:  28.00, unit: 'm³' },
    revisionsschacht_dn600:  { label: 'Revisionsschacht Betonfertigteil DN600 setzen',          price: 485.00, unit: 'Stk'},
    // Fugen & Anschlüsse
    fugenband:               { label: 'Fugenband Arbeitsfuge einlegen',                         price:  18.00, unit: 'm'  },
    rohranschluss_mansch:    { label: 'Rohranschluss-Dichtmanschette Kelleraußenwand',          price:  85.00, unit: 'Stk'},
    anschlussfuge_sil:       { label: 'Anschlussfuge Silikon / Polysulfid abdichten',          price:   9.50, unit: 'm'  },
  },

  /** WDVS / Fassadendämmung €/Einheit – BKI Mittelwerte netto 2024 (KG 330/360) */
  wdvs: {
    // Vorbereitung
    untergrundpruefung:     { label: 'Untergrundprüfung Fassade (Haftzug)',                     price: 285.00, unit: 'Pauschal'},
    altputz_reinigen:       { label: 'Fassade abwaschen / Altputz reinigen',                    price:   4.50, unit: 'm²' },
    risse_schliessen:       { label: 'Risse und Fehlstellen Fassade sanieren',                  price:  18.00, unit: 'm²' },
    // WDVS EPS (Polystyrol)
    eps_80_system:          { label: 'WDVS EPS 80mm komplett (Kleber, Dübel, Armierung, Putz)', price:  88.00, unit: 'm²' },
    eps_100_system:         { label: 'WDVS EPS 100mm komplett (BKI 2024 Mittelwert)',           price:  97.00, unit: 'm²' },
    eps_140_system:         { label: 'WDVS EPS 140mm komplett – KfW Effizienzhaus-Standard',   price: 118.00, unit: 'm²' },
    eps_200_system:         { label: 'WDVS EPS 200mm komplett – KfW 40 EE Standard',           price: 138.00, unit: 'm²' },
    // WDVS Mineralwolle
    mw_100_system:          { label: 'WDVS Mineralwolle 100mm komplett – nichtbrennbar A2',     price: 128.00, unit: 'm²' },
    mw_140_system:          { label: 'WDVS Mineralwolle 140mm komplett',                        price: 148.00, unit: 'm²' },
    mw_180_system:          { label: 'WDVS Mineralwolle 180mm komplett – EH 40 EE',            price: 168.00, unit: 'm²' },
    // WDVS Holzfaser
    holzfaser_100_system:   { label: 'WDVS Holzfaserplatte 100mm komplett (diffusionsoffen)',  price: 155.00, unit: 'm²' },
    holzfaser_140_system:   { label: 'WDVS Holzfaserplatte 140mm komplett',                    price: 180.00, unit: 'm²' },
    // Sockeldämmung
    sockel_xps_80:          { label: 'Sockeldämmung XPS 80mm (Perimeter)',                     price:  78.00, unit: 'm²' },
    sockel_xps_120:         { label: 'Sockeldämmung XPS 120mm (Perimeter)',                    price:  95.00, unit: 'm²' },
    startprofil:            { label: 'Startprofil / Sockelprofil (Aluschiene) montieren',       price:  12.00, unit: 'm'  },
    laibungsdaemm:          { label: 'Laibungsdämmstreifen 30mm Fenster/Türöffnung',            price:  42.00, unit: 'm'  },
    eckschutz_alu:          { label: 'Eckschutzschiene Alu auf Außenecken',                     price:   8.50, unit: 'm'  },
    apu_leiste_fassade:     { label: 'Anputzleiste / APU-Leiste Fenster-/Türanschluss',         price:   7.50, unit: 'm'  },
    // Innendämmung
    innen_kalzsi_60:        { label: 'Innendämmung Kalziumsilikat 60mm (kapillaraktiv)',        price:  88.00, unit: 'm²' },
    innen_pir_60:           { label: 'Innendämmung PIR-Platte 60mm inkl. Dampfsperre',          price:  75.00, unit: 'm²' },
    // Oberputze Fassade
    oberputz_mineral:       { label: 'Mineralischer Oberputz 2mm (Kratzer-/Scheibenputz)',      price:  24.00, unit: 'm²' },
    oberputz_silharz:       { label: 'Silikonharz-Oberputz 2mm pastös',                        price:  32.00, unit: 'm²' },
    oberputz_silikat:       { label: 'Silikat-Oberputz 2mm',                                   price:  28.00, unit: 'm²' },
    fassadenfarbe_silharz:  { label: 'Fassadenfarbe Silikonharz 2× auftragen',                  price:  12.00, unit: 'm²' },
    fassadenfarbe_silikat:  { label: 'Fassadenfarbe Silikat 2× auftragen',                      price:  14.00, unit: 'm²' },
    buntsteinputz_sockel:   { label: 'Buntsteinputz / Mosaikputz 3mm Sockelbereich',            price:  45.00, unit: 'm²' },
  },

  /** Estricharbeiten €/Einheit – BKI Mittelwerte netto 2024 (KG 352) */
  estrich: {
    // Dämmung unter Estrich
    daemm_eps_t30:          { label: 'Trittschalldämmplatte EPS-T 30mm',                       price:   9.80, unit: 'm²' },
    daemm_eps_t40:          { label: 'Trittschalldämmplatte EPS-T 40mm',                       price:  13.00, unit: 'm²' },
    daemm_mw_t30:           { label: 'Trittschalldämmung Mineralwolle MW-T 30mm',               price:  16.00, unit: 'm²' },
    waermedaemm_eps040_60:  { label: 'Wärmedämmung EPS 040 60mm (Bodenaufbau EG)',             price:  14.00, unit: 'm²' },
    waermedaemm_eps035_80:  { label: 'Wärmedämmung EPS 035 80mm',                              price:  20.00, unit: 'm²' },
    waermedaemm_eps035_100: { label: 'Wärmedämmung EPS 035 100mm (Effizienzhaus)',             price:  26.00, unit: 'm²' },
    ausgleichsschuettung:   { label: 'Ausgleichsschüttung Perlite/Blähton 20–80mm',            price:  22.00, unit: 'm²' },
    pe_trennlage:           { label: 'PE-Trennlage 0,2mm verlegen',                            price:   2.50, unit: 'm²' },
    randdaemmstreifen:      { label: 'Randdämmstreifen 10mm verlegen',                          price:   2.80, unit: 'm'  },
    // Zementestrich
    ze_45_schwimm:          { label: 'Zementestrich ZE 20/45mm schwimmend',                    price:  32.00, unit: 'm²' },
    ze_60_schwimm:          { label: 'Zementestrich ZE 20/60mm schwimmend',                    price:  36.00, unit: 'm²' },
    ze_80_schwimm:          { label: 'Zementestrich ZE 20/80mm schwimmend',                    price:  42.00, unit: 'm²' },
    verbundestrich_30:      { label: 'Verbundestrich Zement 30mm direkt auf Beton',            price:  26.00, unit: 'm²' },
    ze_industrie_80:        { label: 'Zementestrich Industrie 80mm bewehrt',                   price:  52.00, unit: 'm²' },
    // Anhydrit-/Fließestrich
    ae_40_schwimm:          { label: 'Anhydritestrich AE 20/40mm schwimmend',                  price:  28.00, unit: 'm²' },
    ae_50_schwimm:          { label: 'Anhydritestrich AE 20/50mm schwimmend',                  price:  30.00, unit: 'm²' },
    ca_f5_35:               { label: 'Calciumsulfat-Fließestrich CA F5/35mm',                  price:  28.00, unit: 'm²' },
    // Heizestrich / FBH
    heizestrich_ze_45:      { label: 'Heizestrich Zement ZE 20/45mm auf FBH-Systemplatte',    price:  38.00, unit: 'm²' },
    heizestrich_ae_45:      { label: 'Heizestrich Anhydrit AE 20/45mm',                        price:  34.00, unit: 'm²' },
    fbh_systemplatte_30:    { label: 'FBH-Systemnoppenplatte 30mm verlegen',                   price:  22.00, unit: 'm²' },
    fbh_rohr_16:            { label: 'FBH-Rohr Verbundrohr 16×2mm verlegen',                   price:   8.50, unit: 'm'  },
    fbh_verteiler_6k:       { label: 'Heizkreisverteiler 6-Kanal inkl. Stellantriebe',         price: 285.00, unit: 'Stk'},
    fbh_verteiler_10k:      { label: 'Heizkreisverteiler 10-Kanal inkl. Stellantriebe',        price: 425.00, unit: 'Stk'},
    // Trockenestrich
    trockenestrich_22:      { label: 'Trockenestrich Fertigteilplatte 22mm (z. B. Fermacell)', price:  52.00, unit: 'm²' },
    trockenestrich_eps_35:  { label: 'Trockenestrich EPS-kaschiert 35mm',                      price:  68.00, unit: 'm²' },
    // Finish & Nachbehandlung
    estrich_schleifen:      { label: 'Estrich schärfen / schleifen',                            price:   4.00, unit: 'm²' },
    nivelliermasse_5:       { label: 'Nivelliermasse bis 5mm aufbringen',                      price:   9.00, unit: 'm²' },
    dehnjuge:               { label: 'Dehnfuge setzen im Estrich',                             price:  12.00, unit: 'm'  },
    versiegelung:           { label: 'Estrich versiegeln / härten (Kellerböden)',               price:  14.00, unit: 'm²' },
    cm_messung:             { label: 'Belegreifheitsmessung CM (Anhydrit-/Heizestrich)',       price:  45.00, unit: 'Stk'},
  },

  /** Tischler / Schreiner €/Einheit – BKI Mittelwerte netto 2024 (KG 349/352) */
  tischler: {
    // Einbauküchen
    einbauk_4m:             { label: 'Einbauküche bis 4m Länge montieren (ohne Geräte)',       price: 6500.00, unit: 'Set'},
    einbauk_6m:             { label: 'Einbauküche 4–6m Länge montieren (ohne Geräte)',         price: 9500.00, unit: 'Set'},
    kueche_arbeitsplatte_lam: { label: 'Küchenarbeitsplatte Laminat 30mm',                     price:  125.00, unit: 'm'  },
    kueche_arbeitsplatte_hz: { label: 'Küchenarbeitsplatte Massivholz 40mm',                   price:  285.00, unit: 'm'  },
    kueche_fronten:         { label: 'Küchenfronten erneuern (bestehende Korpusse)',            price: 2800.00, unit: 'Set'},
    // Einbauschränke
    einbauschrank_2m:       { label: 'Einbauschrank Schlafzimmer 2m breit raumhoch',           price: 1250.00, unit: 'Stk'},
    einbauschrank_3m:       { label: 'Einbauschrank 3m breit raumhoch',                        price: 1900.00, unit: 'Stk'},
    garderobe_einbau:       { label: 'Garderobenschrank Einbau bis 1,5m',                      price:  950.00, unit: 'Stk'},
    // Treppen Holz
    holztreppe_gerade:      { label: 'Holztreppe gerade einläufig 10–14 Stufen inkl. Geländer', price: 5800.00, unit: 'Stk'},
    holztreppe_gewend:      { label: 'Holztreppe gewendelt 16–18 Stufen inkl. Geländer',       price: 8500.00, unit: 'Stk'},
    treppenstufe_hz:        { label: 'Treppenstufe Massivholz Einzelaustausch',                price:  185.00, unit: 'Stk'},
    handlauf_holz:          { label: 'Handlauf Holz rund ∅45mm inkl. Konsolen',                price:   95.00, unit: 'm'  },
    gelaender_holz:         { label: 'Holzgeländer mit Stäben / Sprossen',                     price:  245.00, unit: 'm'  },
    // Leisten & Anschlüsse
    fussleiste_mdf:         { label: 'Fußleiste MDF lackiert 16×58mm',                        price:   15.00, unit: 'm'  },
    fussleiste_massiv:      { label: 'Fußleiste Massivholz Eiche/Buche 20×60mm',               price:   28.00, unit: 'm'  },
    fensterbank_mdf:        { label: 'Fensterbank innen MDF weiß',                             price:   48.00, unit: 'm'  },
    fensterbank_massiv:     { label: 'Fensterbank innen Massivholz Eiche',                     price:  115.00, unit: 'm'  },
    // Badmöbel
    waschk_unterschrank:    { label: 'Waschtischunterschrank Bad inkl. Waschtischplatte',       price:  485.00, unit: 'Stk'},
    spiegelschrank_bad:     { label: 'Spiegelschrank Bad 80cm inkl. LED u. Steckdose',         price:  385.00, unit: 'Stk'},
  },

  /** Metallbau / Schlosser €/Einheit – BKI Mittelwerte netto 2024 (KG 367) */
  metallbau: {
    // Treppen & Geländer
    stahltreppe_gerade:     { label: 'Stahltreppe einläufig gerade 10–14 Stufen',             price: 4800.00, unit: 'Stk'},
    stahltreppe_gewend:     { label: 'Stahltreppe gewendelt inkl. Geländer',                  price: 6500.00, unit: 'Stk'},
    gelaender_stahl:        { label: 'Geländer Stahl verzinkt lackiert',                       price:  185.00, unit: 'm'  },
    gelaender_edelstahl:    { label: 'Geländer Edelstahl V2A poliert',                         price:  380.00, unit: 'm'  },
    gelaender_glas:         { label: 'Glasgeländer ESG mit Edelstahlpfosten',                  price:  485.00, unit: 'm'  },
    handlauf_edelstahl:     { label: 'Handlauf Edelstahl rund ∅42,4mm inkl. Wandbefestigung', price:  145.00, unit: 'm'  },
    // Tore & Türen Metall
    haustuer_stahl_rc2:     { label: 'Haustür Stahl Sicherheitstür RC2',                       price: 2800.00, unit: 'Stk'},
    haustuer_stahl_rc3:     { label: 'Sicherheitstür RC3 Stahl / Multisperre',                price: 4200.00, unit: 'Stk'},
    kellertuer_gitter:      { label: 'Kellertür / Gittertür Stahl',                            price:  685.00, unit: 'Stk'},
    garagentor_sektion:     { label: 'Garagentor Sektionaltor motorisch 2500×2125mm',          price: 2200.00, unit: 'Stk'},
    schiebetor_motor:       { label: 'Schiebetor Stahl motorisch 3000mm',                      price: 3800.00, unit: 'Stk'},
    brandschutztuer_t30:    { label: 'Brandschutztür T30 Stahl einflüglig inkl. Zarge',       price: 1850.00, unit: 'Stk'},
    brandschutztuer_t90:    { label: 'Brandschutztür T90 Stahl einflüglig inkl. Zarge',       price: 2600.00, unit: 'Stk'},
    // Stahlkonstruktionen
    stahltutze_heb:         { label: 'Stahlstütze HEB/HEA liefern u. einbauen',               price: 1250.00, unit: 'Stk'},
    stahltraeger_lm:        { label: 'Stahlträger IPE/HEB je laufendem Meter',                 price:  185.00, unit: 'm'  },
    stahltraeger_sturz:     { label: 'Stahlträger Sturz über Wandöffnung liefern u. einbauen', price:  685.00, unit: 'Stk'},
    balkonkonstruktion:     { label: 'Balkonkonstruktion Stahl auskragend (feuerverzinkt)',     price: 4800.00, unit: 'Stk'},
    // Sonstiges
    briefkasten_mfh:        { label: 'Briefkastenanlage Mehrfamilienhaus 4–6 Einheiten',       price:  650.00, unit: 'Stk'},
    gegensprechanlage:      { label: 'Klingel-/Gegensprechanlage MFH inkl. Verdrahtung',       price: 1850.00, unit: 'Stk'},
    aussentreppe_stahl:     { label: 'Außentreppe Stahl 5 Stufen feuerverzinkt',               price: 2200.00, unit: 'Stk'},
    fensterbank_alu:        { label: 'Metall-Fensterbank Aluminium gekantet',                   price:   58.00, unit: 'm'  },
    attika_blech:           { label: 'Attika-Abdeckblech Aluminium gekantet',                  price:   62.00, unit: 'm'  },
    lichtschacht:           { label: 'Lichtschacht Stahl / Kunststoff Kellerfenster',           price:  285.00, unit: 'Stk'},
    absturzsicherung_dach:  { label: 'Absturzsicherung Dach (Anschlagpunkte / Kante)',         price: 1250.00, unit: 'Pauschal'},
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
