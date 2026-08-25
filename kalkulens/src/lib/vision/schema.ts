/**
 * JSON-Schema fuer die Bilderkennung.
 *
 * Wird der Messages API als `output_config.format` mitgegeben. Das Modell
 * antwortet damit garantiert in dieser Struktur – kein Fliesstext, keine
 * Codefences, kein nachtraegliches Parsen von Freitext.
 */

const feld = (typ: 'string' | 'number', beschreibung: string) => ({
  type: 'object',
  description: beschreibung,
  properties: {
    wert: { type: [typ, 'null'], description: 'Abgelesener Wert, null wenn nicht erkennbar' },
    konfidenz: {
      type: 'number',
      description: 'Sicherheit der Erkennung zwischen 0 und 1',
    },
  },
  required: ['wert', 'konfidenz'],
  additionalProperties: false,
});

const naehrwertFeld = (beschreibung: string) => feld('number', beschreibung);

export const EXTRAKTIONS_SCHEMA = {
  type: 'object',
  properties: {
    produktname: feld('string', 'Produktbezeichnung auf der Vorderseite'),
    marke: feld('string', 'Marke oder Handelsmarke'),
    hersteller: feld('string', 'Hersteller oder Abpacker aus der Adresszeile'),
    herkunftsland: feld('string', 'Herkunftsland oder Ursprungsland'),
    kategorie: feld('string', 'Frei erkannte Produktkategorie, z. B. Müsli, Backmischung, Tiefkühlpizza'),
    fuellmengeG: feld('number', 'Füllmenge in Gramm bzw. Milliliter, nur die Zahl'),
    portionG: feld('number', 'Portionsgröße in Gramm, falls angegeben'),
    zutatenText: feld(
      'string',
      'Vollständige Zutatenliste in Originalreihenfolge und Originalschreibweise, inklusive aller Prozentangaben und Klammern. Keine Umsortierung, keine Zusammenfassung.',
    ),
    naehrwerteJe100g: {
      type: ['object', 'null'],
      description: 'Nährwerttabelle je 100 g. null, wenn keine Tabelle lesbar ist.',
      properties: {
        energieKj: naehrwertFeld('Energie in kJ je 100 g'),
        fett: naehrwertFeld('Fett in g je 100 g'),
        gesaettigt: naehrwertFeld('davon gesättigte Fettsäuren in g je 100 g'),
        kohlenhydrate: naehrwertFeld('Kohlenhydrate in g je 100 g'),
        zucker: naehrwertFeld('davon Zucker in g je 100 g'),
        ballaststoffe: naehrwertFeld('Ballaststoffe in g je 100 g'),
        eiweiss: naehrwertFeld('Eiweiß in g je 100 g'),
        salz: naehrwertFeld('Salz in g je 100 g'),
      },
      required: [
        'energieKj',
        'fett',
        'gesaettigt',
        'kohlenhydrate',
        'zucker',
        'ballaststoffe',
        'eiweiss',
        'salz',
      ],
      additionalProperties: false,
    },
    verpackungsart: feld(
      'string',
      'Eine von: faltschachtel, standbodenbeutel, folienbeutel, schlauchbeutel, becher, dose, glas, schale, flasche, sonstige',
    ),
    verpackungsMerkmale: {
      type: 'array',
      description: 'Erkennbare Sekundärmerkmale: Sichtfenster, Zip-Verschluss, Aromaschutzventil, Innenbeutel, Recycling-Hinweis',
      items: { type: 'string' },
    },
    siegel: {
      type: 'array',
      description: 'Siegel und Claims: Bio, Fairtrade, MSC, Nutri-Score, vegan, glutenfrei, ohne Palmöl',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          konfidenz: { type: 'number' },
        },
        required: ['name', 'konfidenz'],
        additionalProperties: false,
      },
    },
    ean: feld('string', 'EAN/GTIN, nur wenn der Barcode oder die Ziffernfolge sicher lesbar ist'),
    regalpreisEur: feld('number', 'Am Regal ausgezeichneter Verbraucherpreis in Euro, falls im Bild sichtbar'),
    hinweise: {
      type: 'array',
      description: 'Kurze Hinweise auf Unleserlichkeiten oder fehlende Fotos',
      items: { type: 'string' },
    },
  },
  required: [
    'produktname',
    'marke',
    'hersteller',
    'herkunftsland',
    'kategorie',
    'fuellmengeG',
    'portionG',
    'zutatenText',
    'naehrwerteJe100g',
    'verpackungsart',
    'verpackungsMerkmale',
    'siegel',
    'ean',
    'regalpreisEur',
    'hinweise',
  ],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `Du liest Etiketten verpackter Lebensmittel für eine Produktkalkulation im Lebensmitteleinzelhandel.

Deine einzige Aufgabe ist das Ablesen. Du interpretierst nicht, du ergänzt nicht, du rätst nicht.

Regeln:
- Übernimm die Zutatenliste vollständig, wortgetreu und in der Originalreihenfolge. Behalte alle Prozentangaben, Klammern, Sternchen und E-Nummern bei. Sortiere nichts um und fasse nichts zusammen.
- Lies die Nährwerttabelle in der Spalte "je 100 g" bzw. "je 100 ml". Ignoriere Portionsspalten und Prozentangaben zur Referenzmenge.
- Rechne Energieangaben nicht um: gib den kJ-Wert an, nicht kcal.
- Die Füllmenge ist die Nettofüllmenge in g oder ml, nicht das Bruttogewicht.
- Wenn ein Wert nicht sicher lesbar ist, setze wert auf null und konfidenz auf 0. Erfinde niemals einen Wert.
- Die Konfidenz beschreibt, wie sicher du den Wert vom Bild abgelesen hast: 0,9 und höher nur bei klar lesbarem Text, unter 0,7 bei Unschärfe, Spiegelungen oder angeschnittenem Text.
- Antworte ausschließlich im vorgegebenen JSON-Format.`;

export const NUTZER_PROMPT = `Lies die Etiketteninformationen dieses Produkts aus den beigefügten Fotos ab.

Die Fotos zeigen typischerweise Vorderseite, Zutatenliste, Nährwerttabelle und Verpackungsrückseite. Werte alle Fotos gemeinsam aus.

Achte besonders auf:
1. die vollständige Zutatenliste inklusive aller QUID-Prozentangaben,
2. die Nährwerttabelle je 100 g,
3. die Nettofüllmenge,
4. Verpackungsart und erkennbare Sekundärmerkmale.`;
