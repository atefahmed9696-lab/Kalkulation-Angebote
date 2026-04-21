const Tesseract = require('tesseract.js');

async function runOCR(imagePath) {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'deu', {
    logger: () => {}
  });
  return text;
}

function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const datum = extractDatum(text);
  const markt = extractMarkt(lines);
  const gesamtsumme = extractGesamtsumme(text);
  const positionen = extractPositionen(lines);
  const kategorie = inferKategorie(markt);

  return { datum, markt, gesamtsumme, positionen, kategorie };
}

function extractDatum(text) {
  const match = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function extractMarkt(lines) {
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 2) return line;
  }
  return null;
}

function extractGesamtsumme(text) {
  const keywords = /(?:Summe|Gesamt(?:betrag)?|Total|Betrag|SUMME|GESAMT|TOTAL|Zu zahlen|Endbetrag)[:\s*]*([0-9]+[.,][0-9]{2})/i;
  const match = text.match(keywords);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  // fallback: look for the last price-like value
  const prices = [...text.matchAll(/\b(\d{1,3}[.,]\d{2})\s*(?:[A-Z*]|\n|$)/g)];
  if (prices.length > 0) {
    const last = prices[prices.length - 1][1];
    return parseFloat(last.replace(',', '.'));
  }
  return null;
}

function extractPositionen(lines) {
  const positionen = [];
  const priceAtEnd = /^(.+?)\s+(\d+[.,]\d{2})\s*[A-Z*]?\s*$/;
  const qtyPrice = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+[xX*]\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*[A-Z*]?\s*$/;

  for (const line of lines) {
    const qtyMatch = line.match(qtyPrice);
    if (qtyMatch) {
      positionen.push({
        beschreibung: qtyMatch[1].trim(),
        menge: parseFloat(qtyMatch[2].replace(',', '.')),
        einzelpreis: parseFloat(qtyMatch[3].replace(',', '.')),
        gesamtpreis: parseFloat(qtyMatch[4].replace(',', '.'))
      });
      continue;
    }
    const simple = line.match(priceAtEnd);
    if (simple) {
      const preis = parseFloat(simple[2].replace(',', '.'));
      const skipKeywords = /summe|gesamt|total|betrag|mwst|ust|steuer|bar|karte|zahlen|rabatt|pfand/i;
      if (!skipKeywords.test(simple[1])) {
        positionen.push({
          beschreibung: simple[1].trim(),
          menge: 1,
          einzelpreis: preis,
          gesamtpreis: preis
        });
      }
    }
  }
  return positionen;
}

function inferKategorie(markt) {
  if (!markt) return 'Sonstiges';
  const m = markt.toLowerCase();
  if (/obi|bauhaus|hornbach|toom|hagebau/.test(m)) return 'Baumaterial';
  if (/lidl|aldi|rewe|edeka|penny|netto|kaufland|norma|spar/.test(m)) return 'Lebensmittel';
  return 'Sonstiges';
}

module.exports = { runOCR, parseReceiptText };
