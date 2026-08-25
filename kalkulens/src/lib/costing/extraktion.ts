import type { Naehrwerte, Verpackungsart } from './types';

/**
 * Vertrag fuer die Bilderkennung.
 *
 * Das Vision-Modell liefert genau diese Struktur als striktes JSON zurueck.
 * Jedes Feld traegt einen Konfidenzwert; Felder unter 0,7 werden im UI gelb
 * markiert und zur Pruefung angeboten.
 */

export interface Feld<T> {
  wert: T | null;
  konfidenz: number;
}

export interface ExtraktionsErgebnis {
  produktname: Feld<string>;
  marke: Feld<string>;
  hersteller: Feld<string>;
  herkunftsland: Feld<string>;
  kategorie: Feld<string>;
  fuellmengeG: Feld<number>;
  portionG: Feld<number>;
  zutatenText: Feld<string>;
  naehrwerteJe100g: { [K in keyof Naehrwerte]: Feld<number> } | null;
  verpackungsart: Feld<Verpackungsart>;
  verpackungsMerkmale: string[];
  siegel: { name: string; konfidenz: number }[];
  ean: Feld<string>;
  regalpreisEur: Feld<number>;
  hinweise: string[];
}

const LEERES_FELD = <T>(): Feld<T> => ({ wert: null, konfidenz: 0 });

export function leereExtraktion(): ExtraktionsErgebnis {
  return {
    produktname: LEERES_FELD<string>(),
    marke: LEERES_FELD<string>(),
    hersteller: LEERES_FELD<string>(),
    herkunftsland: LEERES_FELD<string>(),
    kategorie: LEERES_FELD<string>(),
    fuellmengeG: LEERES_FELD<number>(),
    portionG: LEERES_FELD<number>(),
    zutatenText: LEERES_FELD<string>(),
    naehrwerteJe100g: null,
    verpackungsart: LEERES_FELD<Verpackungsart>(),
    verpackungsMerkmale: [],
    siegel: [],
    ean: LEERES_FELD<string>(),
    regalpreisEur: LEERES_FELD<number>(),
    hinweise: [],
  };
}

const VERPACKUNGSARTEN: Verpackungsart[] = [
  'faltschachtel',
  'standbodenbeutel',
  'folienbeutel',
  'becher',
  'dose',
  'glas',
  'schlauchbeutel',
  'schale',
  'flasche',
  'sonstige',
];

function zahlAus(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function textAus(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

function konfidenzAus(v: unknown, standard = 0.5): number {
  const n = zahlAus(v);
  if (n === null) return standard;
  const k = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, k));
}

/** Liest ein Feld, das entweder roh oder als { wert, konfidenz } vorliegt. */
function feld<T>(quelle: unknown, wandle: (v: unknown) => T | null): Feld<T> {
  if (quelle === null || quelle === undefined) return { wert: null, konfidenz: 0 };
  if (typeof quelle === 'object' && !Array.isArray(quelle)) {
    const o = quelle as Record<string, unknown>;
    const roh = 'wert' in o ? o.wert : 'value' in o ? o.value : null;
    const wert = wandle(roh);
    return { wert, konfidenz: wert === null ? 0 : konfidenzAus(o.konfidenz ?? o.confidence) };
  }
  const wert = wandle(quelle);
  return { wert, konfidenz: wert === null ? 0 : 0.6 };
}

/**
 * Normalisiert die Antwort des Vision-Modells.
 * Robust gegenueber fehlenden Feldern und abweichenden Schreibweisen –
 * fehlende Werte werden zu `null`, nicht zu Fantasiezahlen.
 */
export function normalisiereExtraktion(roh: unknown): ExtraktionsErgebnis {
  const e = leereExtraktion();
  if (!roh || typeof roh !== 'object') return e;
  const o = roh as Record<string, unknown>;

  e.produktname = feld(o.produktname ?? o.name, textAus);
  e.marke = feld(o.marke, textAus);
  e.hersteller = feld(o.hersteller ?? o.abpacker, textAus);
  e.herkunftsland = feld(o.herkunftsland ?? o.herkunft, textAus);
  e.kategorie = feld(o.kategorie ?? o.produktkategorie, textAus);
  e.fuellmengeG = feld(o.fuellmengeG ?? o.fuellmenge ?? o.fuellmengeGml, zahlAus);
  e.portionG = feld(o.portionG ?? o.portion, zahlAus);
  e.zutatenText = feld(o.zutatenText ?? o.zutatenliste ?? o.zutaten, textAus);
  e.ean = feld(o.ean ?? o.gtin, textAus);
  e.regalpreisEur = feld(o.regalpreisEur ?? o.regalpreis ?? o.preis, zahlAus);

  e.verpackungsart = feld(o.verpackungsart, (v) => {
    const t = textAus(v)?.toLowerCase() ?? '';
    if (!t) return null;
    const treffer = VERPACKUNGSARTEN.find((a) => t.includes(a));
    if (treffer) return treffer;
    if (/schachtel|karton|faltschachtel/.test(t)) return 'faltschachtel';
    if (/standboden|doypack/.test(t)) return 'standbodenbeutel';
    if (/beutel|tüte|tuete/.test(t)) return 'folienbeutel';
    if (/becher/.test(t)) return 'becher';
    if (/dose|konserve/.test(t)) return 'dose';
    if (/glas/.test(t)) return 'glas';
    if (/schale|tray/.test(t)) return 'schale';
    if (/flasche/.test(t)) return 'flasche';
    return 'sonstige';
  });

  const merkmale = o.verpackungsMerkmale ?? o.merkmale ?? o.sekundaermerkmale;
  if (Array.isArray(merkmale)) {
    e.verpackungsMerkmale = merkmale.map(textAus).filter((v): v is string => !!v);
  }

  const siegel = o.siegel ?? o.claims;
  if (Array.isArray(siegel)) {
    e.siegel = siegel
      .map((s) => {
        if (typeof s === 'string') return { name: s, konfidenz: 0.6 };
        if (s && typeof s === 'object') {
          const so = s as Record<string, unknown>;
          const name = textAus(so.name ?? so.bezeichnung ?? so.wert);
          if (!name) return null;
          return { name, konfidenz: konfidenzAus(so.konfidenz ?? so.confidence) };
        }
        return null;
      })
      .filter((s): s is { name: string; konfidenz: number } => s !== null);
  }

  const nw = (o.naehrwerteJe100g ?? o.naehrwerte ?? o.nutrition) as Record<string, unknown> | undefined;
  if (nw && typeof nw === 'object') {
    e.naehrwerteJe100g = {
      energieKj: feld(nw.energieKj ?? nw.energie ?? nw.brennwert, zahlAus),
      fett: feld(nw.fett, zahlAus),
      gesaettigt: feld(nw.gesaettigt ?? nw.gesaettigteFettsaeuren ?? nw.davonGesaettigteFettsaeuren, zahlAus),
      kohlenhydrate: feld(nw.kohlenhydrate, zahlAus),
      zucker: feld(nw.zucker ?? nw.davonZucker, zahlAus),
      ballaststoffe: feld(nw.ballaststoffe, zahlAus),
      eiweiss: feld(nw.eiweiss ?? nw.eiweiß ?? nw.protein, zahlAus),
      salz: feld(nw.salz, zahlAus),
    };
  }

  if (Array.isArray(o.hinweise)) {
    e.hinweise = o.hinweise.map(textAus).filter((v): v is string => !!v);
  }

  return e;
}

/** Baut aus den Extraktionsfeldern ein Naehrwertobjekt – nur wenn genug vorliegt. */
export function naehrwerteAusExtraktion(e: ExtraktionsErgebnis): Naehrwerte | null {
  const nw = e.naehrwerteJe100g;
  if (!nw) return null;
  const werte = Object.values(nw).filter((f) => f.wert !== null);
  if (werte.length < 3) return null;
  return {
    energieKj: nw.energieKj.wert ?? 0,
    fett: nw.fett.wert ?? 0,
    gesaettigt: nw.gesaettigt.wert ?? 0,
    kohlenhydrate: nw.kohlenhydrate.wert ?? 0,
    zucker: nw.zucker.wert ?? 0,
    ballaststoffe: nw.ballaststoffe.wert ?? 0,
    eiweiss: nw.eiweiss.wert ?? 0,
    salz: nw.salz.wert ?? 0,
  };
}

/** Mittlere Konfidenz der Naehrwerttabelle. */
export function naehrwertKonfidenz(e: ExtraktionsErgebnis): number {
  const nw = e.naehrwerteJe100g;
  if (!nw) return 0;
  const werte = Object.values(nw).filter((f) => f.wert !== null);
  if (!werte.length) return 0;
  return werte.reduce((s, f) => s + f.konfidenz, 0) / werte.length;
}
