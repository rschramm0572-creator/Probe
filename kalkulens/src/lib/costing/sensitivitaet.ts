import { berechneKalkulation, type KalkulationsEingabe } from './vollkosten';
import { NEUTRALE_HEBEL, type Hebel } from './types';

/**
 * Simulation und Sensitivitaet.
 *
 * Die Tornado-Analyse variiert jede Annahme einzeln um denselben relativen
 * Betrag und misst die Wirkung auf die Vollkosten. So wird sichtbar, welche
 * Annahme den groessten Hebel hat – und wo eine Nachrecherche lohnt.
 */

export interface TornadoBalken {
  schluessel: keyof Hebel | 'fuellmenge';
  label: string;
  /** Vollkosten bei ungünstiger Auspraegung. */
  hoch: number;
  /** Vollkosten bei guenstiger Auspraegung. */
  niedrig: number;
  /** Spannweite in EUR – Sortierkriterium. */
  spanne: number;
  basis: number;
  beschreibung: string;
}

interface HebelDefinition {
  schluessel: keyof Hebel;
  label: string;
  beschreibung: string;
  /** Ungünstige und guenstige Auspraegung des Faktors. */
  hoch: number;
  niedrig: number;
}

const HEBEL_DEFINITIONEN: HebelDefinition[] = [
  {
    schluessel: 'rohstoffpreisFaktor',
    label: 'Rohstoffpreise',
    beschreibung: '± 20 % auf alle Einkaufspreise',
    hoch: 1.2,
    niedrig: 0.8,
  },
  {
    schluessel: 'verpackungFaktor',
    label: 'Verpackungskosten',
    beschreibung: '± 20 % auf alle Packmittel',
    hoch: 1.2,
    niedrig: 0.8,
  },
  {
    schluessel: 'ausbringungFaktor',
    label: 'Linienleistung',
    beschreibung: '± 25 % Ausbringung je Stunde',
    hoch: 0.75,
    niedrig: 1.25,
  },
  {
    schluessel: 'losgroesseFaktor',
    label: 'Losgröße',
    beschreibung: 'halbe bis doppelte Losgröße',
    hoch: 0.5,
    niedrig: 2,
  },
  {
    schluessel: 'gemeinkostenFaktor',
    label: 'Gemeinkostensätze',
    beschreibung: '± 20 % auf Maschinen-, Verwaltungs- und Vertriebskosten',
    hoch: 1.2,
    niedrig: 0.8,
  },
];

export function berechneTornado(eingabe: KalkulationsEingabe): TornadoBalken[] {
  const basisHebel = eingabe.hebel ?? NEUTRALE_HEBEL;
  const basis = berechneKalkulation({ ...eingabe, hebel: basisHebel }).vollkosten;

  const balken = HEBEL_DEFINITIONEN.map((def) => {
    const hoch = berechneKalkulation({
      ...eingabe,
      hebel: { ...basisHebel, [def.schluessel]: def.hoch } as Hebel,
    }).vollkosten;
    const niedrig = berechneKalkulation({
      ...eingabe,
      hebel: { ...basisHebel, [def.schluessel]: def.niedrig } as Hebel,
    }).vollkosten;
    return {
      schluessel: def.schluessel,
      label: def.label,
      beschreibung: def.beschreibung,
      hoch,
      niedrig,
      basis,
      spanne: Math.abs(hoch - niedrig),
    };
  });

  balken.sort((a, b) => b.spanne - a.spanne);
  return balken;
}

/** Vordefinierter Stresstest: was passiert bei +20 % Rohstoffpreis? */
export interface StresstestErgebnis {
  name: string;
  vollkostenBasis: number;
  vollkostenStress: number;
  deltaAbsolut: number;
  deltaProzent: number;
}

export function stresstest(
  eingabe: KalkulationsEingabe,
  name = '+20 % Rohstoffpreis',
  hebel: Partial<Hebel> = { rohstoffpreisFaktor: 1.2 },
): StresstestErgebnis {
  const basisHebel = eingabe.hebel ?? NEUTRALE_HEBEL;
  const basis = berechneKalkulation({ ...eingabe, hebel: basisHebel }).vollkosten;
  const stress = berechneKalkulation({
    ...eingabe,
    hebel: { ...basisHebel, ...hebel },
  }).vollkosten;
  return {
    name,
    vollkostenBasis: basis,
    vollkostenStress: stress,
    deltaAbsolut: stress - basis,
    deltaProzent: basis > 0 ? ((stress - basis) / basis) * 100 : 0,
  };
}

/** Standardszenarien Best / Base / Worst. */
export const SZENARIO_VORLAGEN: { typ: 'best' | 'base' | 'worst'; name: string; hebel: Hebel }[] = [
  {
    typ: 'best',
    name: 'Best Case',
    hebel: {
      rohstoffpreisFaktor: 0.88,
      verpackungFaktor: 0.9,
      ausbringungFaktor: 1.15,
      losgroesseFaktor: 2,
      gemeinkostenFaktor: 0.92,
      gewinnzuschlagProzent: null,
    },
  },
  {
    typ: 'base',
    name: 'Base Case',
    hebel: { ...NEUTRALE_HEBEL },
  },
  {
    typ: 'worst',
    name: 'Worst Case',
    hebel: {
      rohstoffpreisFaktor: 1.18,
      verpackungFaktor: 1.12,
      ausbringungFaktor: 0.85,
      losgroesseFaktor: 0.5,
      gemeinkostenFaktor: 1.1,
      gewinnzuschlagProzent: null,
    },
  },
];
