import { INGREDIENTS } from '../data/ingredients';
import type { IngredientSeed } from '../data/ingredients';
import type { Qualitaetsstufe } from './types';

/** Ein aus dem Etikettentext gelesener Zutatenlisten-Eintrag. */
export interface ParsedZutat {
  /** Bezeichnung wie auf dem Etikett, bereinigt. */
  etikettName: string;
  /** Deklarierter Prozentsatz (QUID), falls angegeben. */
  quid: number | null;
  /** Top-Level-Position in der Liste, 0-basiert. */
  position: number;
  /** Inhalt der Klammer, falls es sich um eine zusammengesetzte Zutat handelt. */
  unterzutaten: string[];
  /** Zugeordneter Stammsatz. */
  ingredientId: string | null;
  /** Guete der Zuordnung, 0..1. */
  matchKonfidenz: number;
  /** Aus dem Text erkannte Qualitaetsstufe (Bio-Sternchen, "aus biologischem Anbau"). */
  qualitaet: Qualitaetsstufe;
}

const UMLAUTE: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTE[c] ?? c)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Woerter, die fuer das Matching keine Aussage tragen. */
const STOPWOERTER = new Set([
  'und', 'oder', 'aus', 'mit', 'von', 'der', 'die', 'das', 'im', 'in', 'zu',
  'anteil', 'davon', 'sowie', 'ggf', 'teilweise', 'gehaertet', 'gehaertetes',
  'natuerliches', 'natuerliche', 'natuerlicher', 'biologischem', 'anbau',
  'kontrollierter', 'kontrolliertem', 'enthaelt', 'kann', 'spuren',
]);

interface SynonymEintrag {
  ingredient: IngredientSeed;
  norm: string;
  tokens: Set<string>;
}

const SYNONYM_INDEX: SynonymEintrag[] = INGREDIENTS.flatMap((ing) =>
  [ing.name, ...ing.synonyme].map((s) => {
    const norm = normalisiere(s);
    return {
      ingredient: ing,
      norm,
      tokens: new Set(norm.split(' ').filter((t) => t.length > 2 && !STOPWOERTER.has(t))),
    };
  }),
);

/**
 * Ordnet eine Etikettenbezeichnung einem Rohstoff-Stammsatz zu.
 * Reihenfolge: exakte Uebereinstimmung > enthaltenes Synonym > Token-Ueberlappung.
 */
export function matcheZutat(
  etikettName: string,
): { ingredientId: string | null; konfidenz: number } {
  const norm = normalisiere(etikettName);
  if (!norm) return { ingredientId: null, konfidenz: 0 };

  let exakt: SynonymEintrag | null = null;
  let enthalten: { eintrag: SynonymEintrag; laenge: number } | null = null;

  for (const eintrag of SYNONYM_INDEX) {
    if (eintrag.norm === norm) {
      exakt = eintrag;
      break;
    }
    if (eintrag.norm.length >= 4 && norm.includes(eintrag.norm)) {
      if (!enthalten || eintrag.norm.length > enthalten.laenge) {
        enthalten = { eintrag, laenge: eintrag.norm.length };
      }
    }
  }

  if (exakt) return { ingredientId: exakt.ingredient.id, konfidenz: 0.97 };
  if (enthalten) {
    // Je groesser der abgedeckte Anteil der Bezeichnung, desto sicherer.
    const abdeckung = enthalten.laenge / norm.length;
    return {
      ingredientId: enthalten.eintrag.ingredient.id,
      konfidenz: 0.7 + 0.25 * Math.min(1, abdeckung),
    };
  }

  const tokens = new Set(norm.split(' ').filter((t) => t.length > 2 && !STOPWOERTER.has(t)));
  if (tokens.size === 0) return { ingredientId: null, konfidenz: 0 };

  let bester: { id: string; score: number } | null = null;
  for (const eintrag of SYNONYM_INDEX) {
    if (eintrag.tokens.size === 0) continue;
    let treffer = 0;
    for (const t of tokens) {
      for (const st of eintrag.tokens) {
        if (t === st || (t.length > 4 && st.length > 4 && (t.startsWith(st) || st.startsWith(t)))) {
          treffer++;
          break;
        }
      }
    }
    if (treffer === 0) continue;
    const score = treffer / Math.max(tokens.size, eintrag.tokens.size);
    if (!bester || score > bester.score) bester = { id: eintrag.ingredient.id, score };
  }

  if (bester && bester.score >= 0.5) {
    return { ingredientId: bester.id, konfidenz: 0.35 + 0.3 * bester.score };
  }
  return { ingredientId: null, konfidenz: 0 };
}

function istZiffer(c: string | undefined): boolean {
  return !!c && c >= '0' && c <= '9';
}

/**
 * Zerlegt eine Zeichenkette an Kommas, die nicht in Klammern stehen.
 * Ein Komma zwischen zwei Ziffern ist ein Dezimaltrennzeichen ("4,5 %") und
 * trennt keine Zutaten.
 */
function splitTopLevel(text: string): string[] {
  const teile: string[] = [];
  let tiefe = 0;
  let aktuell = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe = Math.max(0, tiefe - 1);
    const istDezimalkomma = c === ',' && istZiffer(text[i - 1]) && istZiffer(text[i + 1]);
    if ((c === ',' || c === ';') && tiefe === 0 && !istDezimalkomma) {
      teile.push(aktuell);
      aktuell = '';
    } else {
      aktuell += c;
    }
  }
  teile.push(aktuell);
  return teile.map((t) => t.trim()).filter(Boolean);
}

const PROZENT_RE = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/;

/**
 * Sammelbegriffe, die auf dem Etikett meist mit einer Klammerangabe stehen
 * ("Pflanzenöl (Palm)"). Fuer sie wird die Klammer ausgewertet.
 */
const GENERISCH = new Set(['pflanzenoel', 'modifizierte_staerke', 'aroma', 'kraeuter', 'lecithin']);

/**
 * Zerlegt einen Zutatenlistentext in strukturierte Eintraege.
 *
 * Erkannt werden: Reihenfolge, QUID-Prozentangaben (vor oder hinter der
 * Bezeichnung), zusammengesetzte Zutaten in Klammern und Bio-Kennzeichnung.
 */
export function parseZutatenliste(text: string): ParsedZutat[] {
  if (!text || !text.trim()) return [];

  let rest = text.replace(/\s+/g, ' ').trim();
  rest = rest.replace(/^zutaten(verzeichnis)?\s*:?\s*/i, '');
  // Allergenhinweise und Spurenkennzeichnung abschneiden.
  rest = rest.split(/\bkann spuren\b|\benth[aä]lt spuren\b|\bunter schutzatmosph/i)[0];

  const teile = splitTopLevel(rest);
  const zutaten: ParsedZutat[] = [];

  teile.forEach((teil, index) => {
    let roh = teil.trim();
    if (!roh || roh.length < 2) return;
    if (/^(mindestens|davon|entspricht)\b/i.test(roh)) return;

    // Bio-Kennzeichnung
    const istBio = /\*|bio\b|biologisch/i.test(roh);

    // QUID
    const prozentTreffer = roh.match(PROZENT_RE);
    const quid = prozentTreffer ? parseFloat(prozentTreffer[1].replace(',', '.')) : null;
    if (prozentTreffer) roh = roh.replace(prozentTreffer[0], ' ');

    // Klammerinhalt = Unterzutaten
    const unterzutaten: string[] = [];
    const klammerRe = /[([]([^()[\]]*)[)\]]/g;
    let m: RegExpExecArray | null;
    while ((m = klammerRe.exec(roh)) !== null) {
      unterzutaten.push(...splitTopLevel(m[1]).map((s) => s.replace(PROZENT_RE, '').trim()));
    }
    let name = roh.replace(/[([][^()[\]]*[)\]]/g, ' ');

    name = name
      .replace(/\bE\s?\d{3}[a-z]?\b/gi, ' ')
      .replace(/[*†‡¹²³]/g, ' ')
      .replace(/\baus (kontrolliert )?biologisch(em)? anbau\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[-–:.\s]+|[-–:.\s]+$/g, '')
      .trim();

    if (!name) {
      // Reine Klassenbezeichnung wie "Emulgator (Lecithine)" – dann Klammer nutzen.
      name = unterzutaten[0] ?? '';
      if (!name) return;
    }

    let treffer = matcheZutat(name);
    if (!treffer.ingredientId && unterzutaten.length > 0) {
      // Bei zusammengesetzten Zutaten ersatzweise ueber die Hauptunterzutat matchen.
      const alt = matcheZutat(unterzutaten[0]);
      if (alt.ingredientId) treffer = { ...alt, konfidenz: alt.konfidenz * 0.8 };
    } else if (treffer.ingredientId && GENERISCH.has(treffer.ingredientId)) {
      // "Pflanzenöl (Palm)" trifft zuerst den Sammelbegriff. Die Klammerangabe
      // benennt aber die konkrete Ware – und die entscheidet ueber Fettsaeure-
      // muster und Preis. Deshalb wird sie vorgezogen, wenn sie sicher trifft.
      for (const unter of unterzutaten) {
        const genauer = matcheZutat(unter);
        if (
          genauer.ingredientId &&
          genauer.ingredientId !== treffer.ingredientId &&
          genauer.konfidenz >= 0.7
        ) {
          treffer = { ingredientId: genauer.ingredientId, konfidenz: genauer.konfidenz * 0.95 };
          break;
        }
      }
    }

    zutaten.push({
      etikettName: name.charAt(0).toUpperCase() + name.slice(1),
      quid: quid !== null && quid > 0 && quid <= 100 ? quid : null,
      position: index,
      unterzutaten,
      ingredientId: treffer.ingredientId,
      matchKonfidenz: treffer.konfidenz,
      qualitaet: istBio ? 'bio' : 'standard',
    });
  });

  return zutaten.map((z, i) => ({ ...z, position: i }));
}
