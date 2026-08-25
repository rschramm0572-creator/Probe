import type { PackagingSpec, Packstoff, Verpackungsart } from './types';

/**
 * Verpackungskalkulation.
 *
 * Materialgewichte werden aus Verpackungsart und Fuellmenge vorgeschaetzt.
 * Alle Schaetzungen sind im UI ueberschreibbar; `geschaetzt` steuert die
 * optische Kennzeichnung.
 */

/** Materialpreise je kg in EUR (Industriebezug, gepflegt). */
export const PACKSTOFF_PREIS: Record<Packstoff, number> = {
  karton: 1.35,
  wellpappe: 0.78,
  'pp-folie': 2.45,
  'pe-folie': 1.95,
  verbundfolie: 4.60,
  aluminium: 5.20,
  weissblech: 1.55,
  glas: 0.62,
  pet: 1.75,
  ps: 2.10,
  holz: 0.35,
};

/**
 * Lizenzentgelt Duales System je kg Material in EUR.
 * Nur Verkaufsverpackungen sind lizenzpflichtig, Transportverpackungen nicht.
 */
export const LIZENZ_JE_KG: Record<Packstoff, number> = {
  karton: 0.22,
  wellpappe: 0.22,
  'pp-folie': 1.28,
  'pe-folie': 1.28,
  verbundfolie: 1.42,
  aluminium: 0.95,
  weissblech: 0.38,
  glas: 0.09,
  pet: 1.10,
  ps: 1.35,
  holz: 0,
};

/** Druckkosten je Farbe und je kg bedrucktem Material. */
const DRUCK_JE_FARBE_JE_KG = 0.42;

interface ArtProfil {
  packstoff: Packstoff;
  /** Grundgewicht je Stueck in g, unabhaengig von der Fuellmenge. */
  basisG: number;
  /** Zusaetzliches Gewicht je g Fuellmenge. */
  faktor: number;
  druckfarben: number;
  /** Konfektionierungszuschlag je Stueck in EUR (Zip, Fenster, Ventil, Deckel). */
  zusatz: number;
  bezeichnung: string;
}

const ART_PROFIL: Record<Verpackungsart, ArtProfil> = {
  faltschachtel: { packstoff: 'karton', basisG: 9, faktor: 0.055, druckfarben: 5, zusatz: 0.004, bezeichnung: 'Faltschachtel' },
  standbodenbeutel: { packstoff: 'verbundfolie', basisG: 4.5, faktor: 0.014, druckfarben: 6, zusatz: 0.028, bezeichnung: 'Standbodenbeutel' },
  folienbeutel: { packstoff: 'pp-folie', basisG: 2.2, faktor: 0.010, druckfarben: 5, zusatz: 0.006, bezeichnung: 'Folienbeutel' },
  schlauchbeutel: { packstoff: 'pp-folie', basisG: 1.6, faktor: 0.008, druckfarben: 4, zusatz: 0.004, bezeichnung: 'Schlauchbeutel' },
  becher: { packstoff: 'ps', basisG: 5.5, faktor: 0.030, druckfarben: 4, zusatz: 0.021, bezeichnung: 'Becher mit Deckel' },
  dose: { packstoff: 'weissblech', basisG: 28, faktor: 0.090, druckfarben: 5, zusatz: 0.018, bezeichnung: 'Konservendose' },
  glas: { packstoff: 'glas', basisG: 95, faktor: 0.480, druckfarben: 4, zusatz: 0.052, bezeichnung: 'Glas mit Twist-off-Deckel' },
  schale: { packstoff: 'pet', basisG: 8, faktor: 0.035, druckfarben: 4, zusatz: 0.030, bezeichnung: 'Schale mit Siegelfolie' },
  flasche: { packstoff: 'pet', basisG: 12, faktor: 0.018, druckfarben: 3, zusatz: 0.026, bezeichnung: 'PET-Flasche mit Verschluss' },
  sonstige: { packstoff: 'pe-folie', basisG: 3, faktor: 0.012, druckfarben: 4, zusatz: 0.008, bezeichnung: 'Primärverpackung' },
};

/** Merkmale, die die Konfektionskosten erhoehen. */
const MERKMAL_ZUSCHLAG: { muster: RegExp; zusatz: number; text: string }[] = [
  { muster: /zip|wiederverschlie/i, zusatz: 0.032, text: 'Zip-Verschluss' },
  { muster: /sichtfenster|fenster/i, zusatz: 0.014, text: 'Sichtfenster' },
  { muster: /aromaschutz|ventil|schutzatmosph/i, zusatz: 0.018, text: 'Aromaschutz' },
  { muster: /innenbeutel|inliner/i, zusatz: 0.035, text: 'Innenbeutel' },
  { muster: /pump|spender|dosier/i, zusatz: 0.085, text: 'Dosierhilfe' },
];

let specCounter = 0;
function specId(): string {
  specCounter += 1;
  return `pk_${specCounter.toString(36)}`;
}

/**
 * Erzeugt einen vollstaendigen Verpackungsvorschlag (primaer, sekundaer,
 * tertiaer) aus Verpackungsart, Fuellmenge und erkannten Merkmalen.
 */
export function schaetzeVerpackung(
  art: Verpackungsart,
  fuellmengeG: number,
  merkmale: string[] = [],
  vePro: { umkarton: number; palette: number } = { umkarton: 12, palette: 720 },
): PackagingSpec[] {
  const p = ART_PROFIL[art] ?? ART_PROFIL.sonstige;
  const menge = Math.max(1, fuellmengeG);

  let zusatz = p.zusatz;
  const merkmalText: string[] = [];
  const alleMerkmale = merkmale.join(' ');
  for (const m of MERKMAL_ZUSCHLAG) {
    if (m.muster.test(alleMerkmale)) {
      zusatz += m.zusatz;
      merkmalText.push(m.text);
    }
  }

  const primaerGewicht = round1(p.basisG + p.faktor * menge);
  const primaer: PackagingSpec = {
    id: specId(),
    ebene: 'primaer',
    bezeichnung: merkmalText.length ? `${p.bezeichnung} (${merkmalText.join(', ')})` : p.bezeichnung,
    packstoff: p.packstoff,
    gewichtG: primaerGewicht,
    materialPreisJeKg: PACKSTOFF_PREIS[p.packstoff],
    druckfarben: p.druckfarben,
    zusatzKostenJeStueck: round3(zusatz),
    vePro: 1,
    menge: 1,
    lizenzJeKg: LIZENZ_JE_KG[p.packstoff],
    geschaetzt: true,
  };

  // Umkarton: Gewicht aus Grundflaeche und Fuellgewicht der Gebindeeinheit.
  const gebindeGewichtKg = ((menge + primaerGewicht) * vePro.umkarton) / 1000;
  const umkarton: PackagingSpec = {
    id: specId(),
    ebene: 'sekundaer',
    bezeichnung: `Umkarton für ${vePro.umkarton} VE`,
    packstoff: 'wellpappe',
    gewichtG: round1(85 + 46 * gebindeGewichtKg),
    materialPreisJeKg: PACKSTOFF_PREIS.wellpappe,
    druckfarben: 1,
    zusatzKostenJeStueck: 0.02,
    vePro: vePro.umkarton,
    menge: 1,
    lizenzJeKg: 0,
    geschaetzt: true,
  };

  const kartonsJePalette = Math.max(1, Math.round(vePro.palette / vePro.umkarton));
  const palette: PackagingSpec = {
    id: specId(),
    ebene: 'tertiaer',
    bezeichnung: 'Europalette (Umlauf, anteilig)',
    packstoff: 'holz',
    gewichtG: 25000,
    materialPreisJeKg: 0.062,
    druckfarben: 0,
    zusatzKostenJeStueck: 0,
    vePro: vePro.palette,
    menge: 1,
    lizenzJeKg: 0,
    geschaetzt: true,
  };

  const stretch: PackagingSpec = {
    id: specId(),
    ebene: 'tertiaer',
    bezeichnung: `Stretchfolie & Zwischenlagen (${kartonsJePalette} Kartons/Palette)`,
    packstoff: 'pe-folie',
    gewichtG: 420,
    materialPreisJeKg: PACKSTOFF_PREIS['pe-folie'],
    druckfarben: 0,
    zusatzKostenJeStueck: 0.35,
    vePro: vePro.palette,
    menge: 1,
    lizenzJeKg: 0,
    geschaetzt: true,
  };

  return [primaer, umkarton, palette, stretch];
}

/** Kosten eines Packmittels je Verkaufseinheit. */
export function kostenJeVe(spec: PackagingSpec): number {
  const materialKg = (spec.gewichtG * spec.menge) / 1000;
  const material = materialKg * spec.materialPreisJeKg;
  const druck = spec.druckfarben * DRUCK_JE_FARBE_JE_KG * materialKg;
  const lizenz = materialKg * spec.lizenzJeKg;
  const zusatz = spec.zusatzKostenJeStueck * spec.menge;
  return (material + druck + lizenz + zusatz) / Math.max(1, spec.vePro);
}

/** Nur der Lizenzentgelt-Anteil je Verkaufseinheit. */
export function lizenzJeVe(spec: PackagingSpec): number {
  const materialKg = (spec.gewichtG * spec.menge) / 1000;
  return (materialKg * spec.lizenzJeKg) / Math.max(1, spec.vePro);
}

export function summiereVerpackung(specs: PackagingSpec[]): {
  gesamt: number;
  primaer: number;
  sekundaer: number;
  tertiaer: number;
  lizenz: number;
  positionen: { spec: PackagingSpec; kostenJeVe: number }[];
} {
  const positionen = specs.map((spec) => ({ spec, kostenJeVe: kostenJeVe(spec) }));
  const summe = (ebene: PackagingSpec['ebene']) =>
    positionen.filter((p) => p.spec.ebene === ebene).reduce((s, p) => s + p.kostenJeVe, 0);
  return {
    gesamt: positionen.reduce((s, p) => s + p.kostenJeVe, 0),
    primaer: summe('primaer'),
    sekundaer: summe('sekundaer'),
    tertiaer: summe('tertiaer'),
    lizenz: specs.reduce((s, spec) => s + lizenzJeVe(spec), 0),
    positionen,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
