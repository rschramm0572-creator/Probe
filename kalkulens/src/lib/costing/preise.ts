import { INGREDIENTS, STAFFEL_FAKTOR, ZERTIFIZIERT_FAKTOR } from '../data/ingredients';
import type { IngredientPrice, Mengenstaffel, Qualitaetsstufe } from './types';

/**
 * Rohstoffpreisdatenbank.
 *
 * Version 1 pflegt Preise manuell – es gibt bewusst keine Boersenanbindung.
 * Die Startwerte sind Industrie-Einkaufspreise je kg, die der Nutzer in der App
 * ueberschreiben kann. Jeder Satz traegt Gueltigkeitsdatum und Quelle.
 */

const SEED_DATUM = '2026-01-01';

export function erzeugeStartpreise(datum = SEED_DATUM): IngredientPrice[] {
  const out: IngredientPrice[] = [];
  for (const ing of INGREDIENTS) {
    const stufen: { q: Qualitaetsstufe; faktor: number }[] = [
      { q: 'standard', faktor: 1 },
      { q: 'bio', faktor: ing.bioFaktor },
      { q: 'zertifiziert', faktor: ZERTIFIZIERT_FAKTOR },
    ];
    for (const { q, faktor } of stufen) {
      const basis = ing.basispreisJeKg * faktor;
      out.push({
        ingredientId: ing.id,
        qualitaet: q,
        preisJeKg: {
          kleinmenge: runde(basis * STAFFEL_FAKTOR.kleinmenge),
          kontrakt: runde(basis * STAFFEL_FAKTOR.kontrakt),
          grosskontrakt: runde(basis * STAFFEL_FAKTOR.grosskontrakt),
        },
        waehrung: 'EUR',
        gueltigAb: datum,
        quelle: 'Startwert KalkuLens',
      });
    }
  }
  return out;
}

function runde(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function preisSchluessel(ingredientId: string, qualitaet: Qualitaetsstufe): string {
  return `${ingredientId}::${qualitaet}`;
}

export interface PreisTreffer {
  preisJeKg: number;
  gefunden: boolean;
  quelle: string;
  gueltigAb: string;
  qualitaet: Qualitaetsstufe;
}

/** Ermittelt den Preis je kg; faellt notfalls auf die Standardqualitaet zurueck. */
export function findePreis(
  preise: Map<string, IngredientPrice>,
  ingredientId: string | null,
  qualitaet: Qualitaetsstufe,
  staffel: Mengenstaffel,
): PreisTreffer {
  if (!ingredientId) {
    return { preisJeKg: 0, gefunden: false, quelle: '—', gueltigAb: '—', qualitaet };
  }
  const treffer =
    preise.get(preisSchluessel(ingredientId, qualitaet)) ??
    preise.get(preisSchluessel(ingredientId, 'standard'));
  if (!treffer) {
    return { preisJeKg: 0, gefunden: false, quelle: '—', gueltigAb: '—', qualitaet };
  }
  return {
    preisJeKg: treffer.preisJeKg[staffel],
    gefunden: true,
    quelle: treffer.quelle,
    gueltigAb: treffer.gueltigAb,
    qualitaet: treffer.qualitaet,
  };
}

export function preisIndex(preise: IngredientPrice[]): Map<string, IngredientPrice> {
  return new Map(preise.map((p) => [preisSchluessel(p.ingredientId, p.qualitaet), p]));
}
