export const CATALOG = {
  // ── Schaltzeichen (Elektro) – DIN EN 60617 / Bauplanübliche Symbole ──
  electrical: [
    // Steckdosen
    { id: "socket",          name: "Steckdose",             width: 0.15, height: 0.15, color: "#f59e0b", symbol: "socket" },
    { id: "socket-double",   name: "Doppelsteckdose",       width: 0.25, height: 0.15, color: "#f59e0b", symbol: "socket-double" },
    { id: "socket-outdoor",  name: "Außensteckdose",        width: 0.15, height: 0.15, color: "#f59e0b", symbol: "socket-outdoor" },
    { id: "socket-floor",    name: "Bodensteckdose",        width: 0.15, height: 0.15, color: "#f59e0b", symbol: "socket-floor" },
    // Schalter
    { id: "switch",          name: "Ausschalter",           width: 0.15, height: 0.15, color: "#f59e0b", symbol: "switch" },
    { id: "switch-2way",     name: "Wechselschalter",       width: 0.15, height: 0.15, color: "#f59e0b", symbol: "switch-2way" },
    { id: "switch-series",   name: "Serienschalter",        width: 0.25, height: 0.15, color: "#f59e0b", symbol: "switch-series" },
    { id: "switch-dimmer",   name: "Dimmer",                width: 0.15, height: 0.15, color: "#f59e0b", symbol: "switch-dimmer" },
    { id: "pushbutton",      name: "Taster",                width: 0.15, height: 0.15, color: "#f59e0b", symbol: "pushbutton" },
    { id: "switch-blind",    name: "Jalousietaster",        width: 0.15, height: 0.15, color: "#f59e0b", symbol: "switch-blind" },
    // Leuchten
    { id: "lamp",            name: "Deckenleuchte",         width: 0.22, height: 0.22, color: "#f59e0b", symbol: "lamp" },
    { id: "lamp-recessed",   name: "Einbauleuchte",         width: 0.22, height: 0.22, color: "#f59e0b", symbol: "lamp-recessed" },
    { id: "lamp-wall",       name: "Wandleuchte",           width: 0.22, height: 0.22, color: "#f59e0b", symbol: "lamp-wall" },
    { id: "lamp-outdoor",    name: "Außenleuchte",          width: 0.22, height: 0.22, color: "#f59e0b", symbol: "lamp-outdoor" },
    { id: "lamp-emergency",  name: "Notleuchte",            width: 0.35, height: 0.15, color: "#f59e0b", symbol: "lamp-emergency" },
    { id: "lamp-strip",      name: "Langfeldleuchte",       width: 0.60, height: 0.12, color: "#f59e0b", symbol: "lamp-strip" },
    // Elektroinstallation
    { id: "fan",             name: "Lüfter/Ventilator",    width: 0.22, height: 0.22, color: "#f59e0b", symbol: "fan" },
    { id: "distribution",    name: "Unterverteiler (UV)",   width: 0.30, height: 0.20, color: "#f59e0b", symbol: "distribution" },
    { id: "smoke-detector",  name: "Rauchmelder",           width: 0.18, height: 0.18, color: "#f59e0b", symbol: "smoke-detector" },
    { id: "co-detector",     name: "CO-Melder",             width: 0.18, height: 0.18, color: "#f59e0b", symbol: "co-detector" },
    { id: "doorbell",        name: "Klingel/Taster",        width: 0.15, height: 0.15, color: "#f59e0b", symbol: "doorbell" },
    { id: "thermostat",      name: "Thermostat",            width: 0.18, height: 0.18, color: "#f59e0b", symbol: "thermostat" },
    { id: "telephone",       name: "Telefondose (TAE)",     width: 0.15, height: 0.15, color: "#f59e0b", symbol: "telephone" },
    { id: "network",         name: "LAN-Dose (RJ45)",       width: 0.15, height: 0.15, color: "#f59e0b", symbol: "network" },
    { id: "tv",              name: "TV/SAT-Antennendose",   width: 0.15, height: 0.15, color: "#f59e0b", symbol: "tv" },
    { id: "motion-sensor",   name: "Bewegungsmelder",       width: 0.20, height: 0.20, color: "#f59e0b", symbol: "motion-sensor" }
  ],
  // ── Sanitärformzeichen – DIN 2429-2 ──
  sanitary: [
    { id: "wc",              name: "WC (Standmodell)",      width: 0.65, height: 0.95, color: "#06b6d4", symbol: "wc" },
    { id: "wc-wall",         name: "Wand-WC",               width: 0.65, height: 0.85, color: "#06b6d4", symbol: "wc-wall" },
    { id: "urinal",          name: "Urinal",                width: 0.40, height: 0.35, color: "#06b6d4", symbol: "urinal" },
    { id: "bidet",           name: "Bidet",                 width: 0.40, height: 0.65, color: "#06b6d4", symbol: "bidet" },
    { id: "sink",            name: "Waschbecken",           width: 0.60, height: 0.50, color: "#06b6d4", symbol: "sink" },
    { id: "sink-double",     name: "Doppelwaschbecken",     width: 1.20, height: 0.50, color: "#06b6d4", symbol: "sink-double" },
    { id: "kitchen-sink",    name: "Küchenspüle",          width: 0.60, height: 0.50, color: "#06b6d4", symbol: "kitchen-sink" },
    { id: "kitchen-sink-dbl",name: "Küchenspüle doppelt",  width: 1.00, height: 0.50, color: "#06b6d4", symbol: "kitchen-sink-dbl" },
    { id: "bathtub",         name: "Badewanne",             width: 0.75, height: 1.70, color: "#06b6d4", symbol: "bathtub" },
    { id: "bathtub-corner",  name: "Eckbadewanne",          width: 1.40, height: 1.40, color: "#06b6d4", symbol: "bathtub-corner" },
    { id: "shower",          name: "Duschplatte",           width: 0.90, height: 0.90, color: "#06b6d4", symbol: "shower" },
    { id: "shower-corner",   name: "Eckdusche",             width: 0.90, height: 0.90, color: "#06b6d4", symbol: "shower-corner" },
    { id: "washing-machine", name: "Waschmaschine",         width: 0.60, height: 0.60, color: "#06b6d4", symbol: "washing-machine" },
    { id: "dryer",           name: "Wäschetrockner",       width: 0.60, height: 0.60, color: "#06b6d4", symbol: "dryer" },
    { id: "dishwasher",      name: "Geschirrspüler",       width: 0.60, height: 0.60, color: "#06b6d4", symbol: "dishwasher" },
    { id: "floor-drain",     name: "Bodenablauf",           width: 0.20, height: 0.20, color: "#06b6d4", symbol: "floor-drain" }
  ],
  // ── Heizungs- / Haustechnik-Formzeichen ──
  heating: [
    { id: "radiator",        name: "Heizkörper",            width: 1.00, height: 0.22, color: "#ef4444", symbol: "radiator" },
    { id: "floor-heating",   name: "Fußbodenheiz.-Verteiler",width: 0.40, height: 0.40, color: "#ef4444", symbol: "floor-heating" },
    { id: "chimney",         name: "Schornstein",           width: 0.40, height: 0.40, color: "#ef4444", symbol: "chimney" },
    { id: "fireplace",       name: "Kaminofen",             width: 0.80, height: 0.60, color: "#ef4444", symbol: "fireplace" },
    { id: "boiler",          name: "Therme/Boiler",         width: 0.60, height: 0.50, color: "#ef4444", symbol: "boiler" },
    { id: "heat-pump",       name: "Wärmepumpe",           width: 0.80, height: 0.60, color: "#ef4444", symbol: "heat-pump" }
  ],
  // ── Trockenbau ──
  drywall: [
    { id: "drywall",         name: "Trockenbauwand",        width: 1.00, height: 0.125, color: "#8b5cf6", symbol: "drywall" },
    { id: "shaftwall",       name: "Schachtwand",           width: 1.00, height: 0.15,  color: "#8b5cf6", symbol: "shaftwall" }
  ],
  // ── Möbel / Einbauten ──
  furniture: [
    { id: "bed-single",      name: "Einzelbett",            width: 0.90, height: 2.00, color: "#a3e635", symbol: "bed-single" },
    { id: "bed-double",      name: "Doppelbett",            width: 1.60, height: 2.00, color: "#a3e635", symbol: "bed-double" },
    { id: "sofa",            name: "Sofa",                  width: 2.20, height: 0.90, color: "#a3e635", symbol: "sofa" },
    { id: "armchair",        name: "Sessel",                width: 0.90, height: 0.90, color: "#a3e635", symbol: "armchair" },
    { id: "desk",            name: "Schreibtisch",          width: 1.20, height: 0.60, color: "#a3e635", symbol: "rect" },
    { id: "table",           name: "Esstisch rechteckig",   width: 1.20, height: 0.80, color: "#a3e635", symbol: "rect" },
    { id: "table-round",     name: "Esstisch rund",         width: 1.20, height: 1.20, color: "#a3e635", symbol: "table-round" },
    { id: "wardrobe",        name: "Schrank",               width: 1.20, height: 0.60, color: "#a3e635", symbol: "wardrobe" },
    { id: "stairs-up",       name: "Treppe (aufsteigend)",  width: 1.00, height: 2.50, color: "#a3e635", symbol: "stairs-up" },
    { id: "stairs-down",     name: "Treppe (absteigend)",   width: 1.00, height: 2.50, color: "#a3e635", symbol: "stairs-down" },
    { id: "column",          name: "Stütze/Säule",         width: 0.30, height: 0.30, color: "#94a3b8", symbol: "column" },
    { id: "column-round",    name: "Rundsäule",             width: 0.30, height: 0.30, color: "#94a3b8", symbol: "column-round" }
  ]
};
