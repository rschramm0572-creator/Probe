import { INGREDIENT_BY_ID } from '../data/ingredients';
import type { Kategorie, Korridor } from '../data/kategorien';
import type { ParsedZutat } from './zutatenParser';
import {
  NAEHRWERT_FELDER,
  NULL_NAEHRWERTE,
  type Naehrwerte,
  type Recipe,
  type RecipeLine,
  type RezepturFit,
} from './types';

/**
 * Rezepturrueckrechnung.
 *
 * Wir kennen die tatsaechliche Rezeptur nicht und behaupten das auch nicht.
 * Was wir tun: aus vier unabhaengigen Informationsquellen einen Anteilsvektor
 * bestimmen, der zu allen vier gleichzeitig passt.
 *
 *   1. Reihenfolgeregel  – die Liste ist absteigend sortiert (harte Schranken)
 *   2. QUID-Anker        – deklarierte Prozente sind fix
 *   3. Naehrwertabgleich – zurueckgerechnete Naehrwerte muessen zur Deklaration passen
 *   4. Kategoriewissen   – typische Korridore als Startwert und Plausibilitaetsschranke
 *
 * Geloest wird das als beschraenktes Kleinste-Quadrate-Problem mit projizierter
 * Gradientenabstiegsmethode. Das Verfahren ist deterministisch: gleiche Eingabe
 * liefert immer dieselbe Rezeptur.
 */

/** Naehrwertprofil fuer Zutaten ohne Stammsatz-Zuordnung. */
const FALLBACK_NAEHRWERTE: Naehrwerte = {
  energieKj: 1200,
  fett: 6,
  gesaettigt: 2,
  kohlenhydrate: 48,
  zucker: 10,
  ballaststoffe: 3,
  eiweiss: 8,
  salz: 0.6,
};

/** Gewichtung der Naehrwerte im Zielfunktional. */
const NAEHRWERT_GEWICHT: Record<keyof Naehrwerte, number> = {
  energieKj: 1.0,
  fett: 1.3,
  gesaettigt: 0.7,
  kohlenhydrate: 1.3,
  zucker: 1.0,
  ballaststoffe: 0.5,
  eiweiss: 1.1,
  salz: 0.9,
};

/** Kleinste sinnvolle Bezugsgroesse je Naehrwert, verhindert Division durch ~0. */
const NAEHRWERT_SKALA: Record<keyof Naehrwerte, number> = {
  energieKj: 300,
  fett: 2,
  gesaettigt: 1,
  kohlenhydrate: 5,
  zucker: 2,
  ballaststoffe: 1,
  eiweiss: 2,
  salz: 0.2,
};

export interface RezepturEingabe {
  zutaten: ParsedZutat[];
  naehrwerte: Naehrwerte | null;
  kategorie: Kategorie;
  /** Bereits vorhandene Zeilen, deren Fixierung erhalten bleiben soll. */
  bestehend?: RecipeLine[];
  verlustQuote?: number;
}

function naehrwerteVon(ingredientId: string | null): Naehrwerte {
  if (!ingredientId) return FALLBACK_NAEHRWERTE;
  return INGREDIENT_BY_ID.get(ingredientId)?.naehrwerte ?? FALLBACK_NAEHRWERTE;
}

function korridorFuer(k: Kategorie, line: { ingredientId: string | null }): Korridor | undefined {
  if (!line.ingredientId) return undefined;
  const direkt = k.korridore.find((c) => c.ingredientId === line.ingredientId);
  if (direkt) return direkt;
  const gruppe = INGREDIENT_BY_ID.get(line.ingredientId)?.gruppe;
  return k.korridore.find((c) => c.gruppe === gruppe);
}

/**
 * Startverteilung: geometrischer Abfall entlang der Zutatenreihenfolge,
 * ueberlagert mit den typischen Korridorwerten der Kategorie.
 */
function startwerte(
  n: number,
  korridore: (Korridor | undefined)[],
): number[] {
  const werte: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = korridore[i];
    // Geometrischer Abfall: jede weitere Position rund 40 % leichter.
    const abfall = 100 * Math.pow(0.6, i);
    werte.push(k ? (k.typisch + abfall) / 2 : abfall);
  }
  return werte;
}

interface Schranken {
  min: number[];
  max: number[];
  fix: (number | null)[];
}

function schranken(
  zutaten: { ingredientId: string | null; quid: number | null }[],
  bestehend: RecipeLine[] | undefined,
  kategorie: Kategorie,
): Schranken {
  const n = zutaten.length;
  const min = new Array<number>(n).fill(0);
  const max = new Array<number>(n).fill(100);
  const fix = new Array<number | null>(n).fill(null);

  for (let i = 0; i < n; i++) {
    // Reihenfolgeregel: Position i (1-basiert) kann hoechstens 100/i haben,
    // weil alle vorangehenden Zutaten mindestens so schwer sind.
    max[i] = 100 / (i + 1);

    const stamm = zutaten[i].ingredientId ? INGREDIENT_BY_ID.get(zutaten[i].ingredientId!) : undefined;
    if (stamm) {
      max[i] = Math.min(max[i], stamm.maxAnteil);
      min[i] = Math.max(min[i], stamm.minAnteil);
    }
    const k = korridorFuer(kategorie, zutaten[i]);
    if (k) {
      // Korridore gelten je Warengruppe, nicht je Zeile – daher nur als
      // Obergrenze verwenden, nie als erzwungene Untergrenze.
      max[i] = Math.min(max[i], Math.max(k.max, min[i] + 0.01));
    }

    const quid = zutaten[i].quid;
    if (quid !== null) fix[i] = Math.min(100, Math.max(0, quid));

    const alt = bestehend?.[i];
    if (alt?.fixiert) fix[i] = alt.anteil;

    if (fix[i] !== null) {
      min[i] = fix[i]!;
      max[i] = fix[i]!;
    } else if (min[i] > max[i]) {
      min[i] = max[i];
    }
  }
  return { min, max, fix };
}

/**
 * Projektion auf die zulaessige Menge:
 * Summe = 100, Schranken eingehalten, absteigende Reihenfolge.
 */
function projiziere(w: number[], s: Schranken): number[] {
  const n = w.length;
  const x = w.slice();

  for (let runde = 0; runde < 40; runde++) {
    // 1. Schranken und Fixwerte
    for (let i = 0; i < n; i++) {
      if (s.fix[i] !== null) x[i] = s.fix[i]!;
      else x[i] = Math.min(s.max[i], Math.max(s.min[i], x[i]));
    }

    // 2. Reihenfolge: absteigend. Freie Zeilen an ihre Nachbarn anpassen.
    for (let i = 1; i < n; i++) {
      if (s.fix[i] === null && x[i] > x[i - 1]) x[i] = Math.max(s.min[i], x[i - 1]);
    }
    for (let i = n - 2; i >= 0; i--) {
      if (s.fix[i] === null && x[i] < x[i + 1]) x[i] = Math.min(s.max[i], x[i + 1]);
    }

    // 3. Summennormierung ueber die freien Zeilen
    let fixSumme = 0;
    let freiSumme = 0;
    let freieZeilen = 0;
    for (let i = 0; i < n; i++) {
      if (s.fix[i] !== null) fixSumme += x[i];
      else {
        freiSumme += x[i];
        freieZeilen++;
      }
    }
    const ziel = 100 - fixSumme;
    if (freieZeilen === 0) break;
    if (ziel <= 0) {
      for (let i = 0; i < n; i++) if (s.fix[i] === null) x[i] = s.min[i];
      break;
    }
    const diff = ziel - freiSumme;
    if (Math.abs(diff) < 1e-7) break;
    if (freiSumme > 1e-9) {
      const faktor = ziel / freiSumme;
      for (let i = 0; i < n; i++) if (s.fix[i] === null) x[i] *= faktor;
    } else {
      for (let i = 0; i < n; i++) if (s.fix[i] === null) x[i] = ziel / freieZeilen;
    }
  }
  return x;
}

/** Naehrwerte je 100 g Fertigprodukt aus einem Anteilsvektor. */
export function berechneNaehrwerte(anteile: number[], profile: Naehrwerte[]): Naehrwerte {
  const out: Naehrwerte = { ...NULL_NAEHRWERTE };
  for (let i = 0; i < anteile.length; i++) {
    const p = profile[i];
    const f = anteile[i] / 100;
    for (const feld of NAEHRWERT_FELDER) out[feld] += p[feld] * f;
  }
  return out;
}

/**
 * Optimiert die Anteile gegen die deklarierten Naehrwerte.
 *
 * Das Zielfunktional ist quadratisch in den Anteilen, die zulaessige Menge ist
 * konvex (Summe, Schranken, Monotonie). Geloest wird mit projiziertem
 * Gradientenabstieg. Die Naehrwerte unterscheiden sich um Groessenordnungen
 * (Energie in kJ, Salz in Zehntelgramm), deshalb wird der Schritt je Koordinate
 * mit der Diagonale der Hesse-Matrix vorkonditioniert – ohne das konvergiert
 * das Verfahren in der Salzrichtung, waehrend es in der Energierichtung steht.
 */
function optimiere(
  start: number[],
  s: Schranken,
  profile: Naehrwerte[],
  ziel: Naehrwerte | null,
  prior: number[],
): number[] {
  let x = projiziere(start, s);
  if (!ziel) return x;

  const felder = NAEHRWERT_FELDER.filter((f) => {
    const v = ziel[f];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
  });
  if (felder.length === 0) return x;

  const n = x.length;
  // Regularisierung haelt die Loesung in der Naehe des Kategorie-Startwerts,
  // solange die Naehrwerte keine andere Aussage erzwingen.
  const muRegularisierung = 0.03;
  const bezug = prior.map((v) => Math.max(v, 1));

  // Diagonale der Hesse-Matrix je Koordinate.
  const hesse = new Array<number>(n).fill(0);
  for (const f of felder) {
    const skala = Math.max(NAEHRWERT_SKALA[f], ziel[f]);
    const c = (2 * NAEHRWERT_GEWICHT[f]) / (skala * skala);
    for (let i = 0; i < n; i++) hesse[i] += c * (profile[i][f] / 100) ** 2;
  }
  for (let i = 0; i < n; i++) {
    hesse[i] += (2 * muRegularisierung) / (bezug[i] * bezug[i]);
  }
  // Daempfung: der vorkonditionierte Schritt wird nur teilweise gegangen,
  // weil die Nebendiagonalen der Hesse-Matrix unberuecksichtigt bleiben.
  const schrittweite = hesse.map((h) => 0.45 / Math.max(h, 1e-9));

  const frei: number[] = [];
  for (let i = 0; i < n; i++) if (s.fix[i] === null) frei.push(i);
  if (frei.length === 0) return x;

  for (let iter = 0; iter < 2500; iter++) {
    const ist = berechneNaehrwerte(x, profile);
    const grad = new Array<number>(n).fill(0);

    for (const f of felder) {
      const skala = Math.max(NAEHRWERT_SKALA[f], ziel[f]);
      const rest = (ist[f] - ziel[f]) / skala;
      const g = (2 * NAEHRWERT_GEWICHT[f] * rest) / skala;
      for (let i = 0; i < n; i++) grad[i] += (g * profile[i][f]) / 100;
    }
    for (let i = 0; i < n; i++) {
      grad[i] += (2 * muRegularisierung * (x[i] - prior[i])) / (bezug[i] * bezug[i]);
    }

    // Schritt auf die Ebene "Summe bleibt 100" projizieren, damit die
    // anschliessende Normierung den Fortschritt nicht wieder zunichtemacht.
    // Der Ausgleich wird in der Metrik der Vorkonditionierung verteilt: eine
    // Zutat wie Salz, deren Anteil sehr scharf bestimmt ist, darf nicht den
    // Ausgleich fuer die grob bestimmten Hauptzutaten tragen.
    let zaehler = 0;
    let nenner = 0;
    for (const i of frei) {
      zaehler += schrittweite[i] * grad[i];
      nenner += schrittweite[i];
    }
    const ausgleich = nenner > 0 ? zaehler / nenner : 0;

    const neu = x.slice();
    let bewegung = 0;
    for (const i of frei) {
      const d = -schrittweite[i] * (grad[i] - ausgleich);
      neu[i] = x[i] + d;
      bewegung += Math.abs(d);
    }
    x = projiziere(neu, s);
    if (bewegung < 1e-9) break;
  }
  return x;
}

/** Vergleicht zurueckgerechnete mit deklarierten Naehrwerten. */
export function bewerteFit(berechnet: Naehrwerte, deklariert: Naehrwerte | null): RezepturFit {
  const abweichung: Partial<Naehrwerte> = {};
  const abweichungProzent: Partial<Naehrwerte> = {};
  let maxAbw = 0;
  let summeQuadrat = 0;
  let anzahl = 0;

  if (deklariert) {
    for (const f of NAEHRWERT_FELDER) {
      const soll = deklariert[f];
      if (!Number.isFinite(soll)) continue;
      const ist = berechnet[f];
      abweichung[f] = ist - soll;
      // Bei sehr kleinen Deklarationswerten waere die relative Abweichung
      // aussagelos – wir beziehen sie dann auf die Mindestskala.
      const bezug = Math.max(Math.abs(soll), NAEHRWERT_SKALA[f]);
      const rel = ((ist - soll) / bezug) * 100;
      abweichungProzent[f] = rel;
      maxAbw = Math.max(maxAbw, Math.abs(rel));
      summeQuadrat += (rel / 100) ** 2;
      anzahl++;
    }
  }

  const rmse = anzahl > 0 ? Math.sqrt(summeQuadrat / anzahl) : 1;
  const guete = deklariert ? Math.max(0, Math.min(1, 1 - rmse * 1.6)) : 0.35;

  return { berechnet, deklariert, abweichung, abweichungProzent, maxAbweichungProzent: maxAbw, guete };
}

/** Konfidenz einer einzelnen Rezepturzeile. */
function zeilenKonfidenz(
  z: ParsedZutat,
  anteil: number,
  min: number,
  max: number,
  fit: number,
): number {
  if (z.quid !== null) return 0.95;
  // Je schmaler das zulaessige Band relativ zum Wert, desto sicherer.
  const band = Math.max(0, max - min);
  const relativ = anteil > 0.5 ? band / anteil : band / 0.5;
  const bandGuete = 1 / (1 + relativ);
  const basis = 0.25 + 0.35 * bandGuete + 0.25 * fit + 0.15 * z.matchKonfidenz;
  return Math.max(0.15, Math.min(0.9, basis));
}

let lineCounter = 0;
function lineId(): string {
  lineCounter += 1;
  return `rl_${lineCounter.toString(36)}`;
}

/** Fuehrt die vollstaendige Rezepturrueckrechnung durch. */
export function berechneRezeptur(eingabe: RezepturEingabe): Recipe {
  const { zutaten, naehrwerte, kategorie, bestehend } = eingabe;
  const verlustQuote = eingabe.verlustQuote ?? kategorie.verlustQuote;

  if (zutaten.length === 0) {
    return { lines: [], verlustQuote, fit: bewerteFit({ ...NULL_NAEHRWERTE }, naehrwerte) };
  }

  const profile = zutaten.map((z) => naehrwerteVon(z.ingredientId));
  const korridore = zutaten.map((z) => korridorFuer(kategorie, z));
  const s = schranken(zutaten, bestehend, kategorie);
  const prior = projiziere(startwerte(zutaten.length, korridore), s);
  const anteile = optimiere(prior, s, profile, naehrwerte, prior);

  const berechnet = berechneNaehrwerte(anteile, profile);
  const fit = bewerteFit(berechnet, naehrwerte);

  const lines: RecipeLine[] = zutaten.map((z, i) => {
    const anteil = anteile[i];
    const istFix = s.fix[i] !== null;
    // Bandbreite: bei QUID null, sonst aus Konfidenz abgeleitet und an den
    // harten Schranken abgeschnitten.
    const konf = zeilenKonfidenz(z, anteil, s.min[i], s.max[i], fit.guete);
    const spanne = istFix ? 0 : anteil * (0.65 - 0.5 * konf) + 0.2;
    return {
      id: bestehend?.[i]?.id ?? lineId(),
      etikettName: z.etikettName,
      ingredientId: z.ingredientId,
      anteil,
      min: Math.max(s.min[i], anteil - spanne),
      max: Math.min(s.max[i], anteil + spanne),
      konfidenz: istFix ? 0.95 : konf,
      quid: z.quid,
      fixiert: istFix,
      unterzutaten: z.unterzutaten.length ? z.unterzutaten : undefined,
      qualitaet: bestehend?.[i]?.qualitaet ?? z.qualitaet,
    };
  });

  return { lines, verlustQuote, fit };
}

/**
 * Rechnet eine bestehende Rezeptur neu, nachdem der Nutzer Zeilen veraendert hat.
 * Fixierte Zeilen bleiben stehen, der Rest wird normiert und – falls Naehrwerte
 * vorliegen – erneut gegen die Deklaration optimiert.
 */
export function aktualisiereRezeptur(
  recipe: Recipe,
  naehrwerte: Naehrwerte | null,
  kategorie: Kategorie,
): Recipe {
  if (recipe.lines.length === 0) return recipe;

  const zutaten: ParsedZutat[] = recipe.lines.map((l, i) => ({
    etikettName: l.etikettName,
    quid: l.quid,
    position: i,
    unterzutaten: l.unterzutaten ?? [],
    ingredientId: l.ingredientId,
    matchKonfidenz: l.ingredientId ? 0.9 : 0,
    qualitaet: l.qualitaet,
  }));

  const profile = zutaten.map((z) => naehrwerteVon(z.ingredientId));
  const korridore = zutaten.map((z) => korridorFuer(kategorie, z));
  const s = schranken(zutaten, recipe.lines, kategorie);
  const prior = projiziere(
    recipe.lines.map((l, i) => (l.anteil > 0 ? l.anteil : startwerte(zutaten.length, korridore)[i])),
    s,
  );
  const anteile = optimiere(prior, s, profile, naehrwerte, prior);
  const berechnet = berechneNaehrwerte(anteile, profile);
  const fit = bewerteFit(berechnet, naehrwerte);

  const lines = recipe.lines.map((l, i) => {
    const anteil = anteile[i];
    const istFix = s.fix[i] !== null;
    const konf = istFix
      ? 0.95
      : zeilenKonfidenz(zutaten[i], anteil, s.min[i], s.max[i], fit.guete);
    const spanne = istFix ? 0 : anteil * (0.65 - 0.5 * konf) + 0.2;
    return {
      ...l,
      anteil,
      min: Math.max(s.min[i], anteil - spanne),
      max: Math.min(s.max[i], anteil + spanne),
      konfidenz: konf,
    };
  });

  return { ...recipe, lines, fit };
}

/** Setzt eine Zeile auf einen Wert, fixiert sie und normiert den Rest. */
export function setzeAnteil(
  recipe: Recipe,
  lineId: string,
  anteil: number,
  naehrwerte: Naehrwerte | null,
  kategorie: Kategorie,
): Recipe {
  const lines = recipe.lines.map((l) =>
    l.id === lineId
      ? { ...l, anteil: Math.max(0, Math.min(100, anteil)), fixiert: true, konfidenz: 0.95 }
      : l,
  );
  return aktualisiereRezeptur({ ...recipe, lines }, naehrwerte, kategorie);
}

/** Hebt die Fixierung einer Zeile auf und rechnet neu. */
export function loeseFixierung(
  recipe: Recipe,
  lineId: string,
  naehrwerte: Naehrwerte | null,
  kategorie: Kategorie,
): Recipe {
  const lines = recipe.lines.map((l) =>
    l.id === lineId && l.quid === null ? { ...l, fixiert: false } : l,
  );
  return aktualisiereRezeptur({ ...recipe, lines }, naehrwerte, kategorie);
}

/** Einsatzmenge je Verkaufseinheit: Fuellmenge zuzueglich Produktionsverlust. */
export function einsatzFaktor(verlustQuote: number): number {
  const q = Math.max(0, Math.min(0.5, verlustQuote));
  return 1 / (1 - q);
}
