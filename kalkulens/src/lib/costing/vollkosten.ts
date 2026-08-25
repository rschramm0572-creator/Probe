import { INGREDIENT_BY_ID } from '../data/ingredients';
import { findePreis } from './preise';
import { einsatzFaktor } from './rezeptur';
import { summiereVerpackung } from './verpackung';
import { euro, euroAuto, prozent, zahl } from './format';
import {
  NEUTRALE_HEBEL,
  type Calculation,
  type CostingProfile,
  type HandelsRechnung,
  type Hebel,
  type IngredientPrice,
  type KostenPosition,
  type Product,
  type RohwarenZeile,
  type Rueckwaertsrechnung,
} from './types';

/**
 * Vollkostenkalkulation nach dem Zuschlagskalkulationsschema.
 *
 *   Rohwarenkosten + Verpackungskosten          = Materialeinzelkosten
 *   + Materialgemeinkosten
 *   + Fertigungseinzelkosten
 *   + Fertigungsgemeinkosten (losgroessenabhaengig)
 *                                               = Herstellkosten
 *   + QS/Labor + F&E + Verwaltung + Vertrieb + Logistik
 *                                               = Vollkosten (Selbstkosten)
 *   + Gewinnzuschlag                            = kalkulatorischer Abgabepreis
 *
 * Jede Position traegt ihre Herleitung mit sich, damit sich im UI jede Zahl
 * per Tap bis auf ihre Annahme zurueckverfolgen laesst.
 */

export interface KalkulationsEingabe {
  product: Product;
  profile: CostingProfile;
  preise: Map<string, IngredientPrice>;
  hebel?: Hebel;
}

/** Wendet die Simulationshebel auf ein Profil an. */
export function wendeHebelAn(profile: CostingProfile, hebel: Hebel): CostingProfile {
  return {
    ...profile,
    ausbringungJeStunde: Math.max(1, profile.ausbringungJeStunde * hebel.ausbringungFaktor),
    losgroesseVe: Math.max(1, profile.losgroesseVe * hebel.losgroesseFaktor),
    maschinenstundensatz: profile.maschinenstundensatz * hebel.gemeinkostenFaktor,
    energieJeStunde: profile.energieJeStunde * hebel.gemeinkostenFaktor,
    materialGemeinkostenProzent: profile.materialGemeinkostenProzent * hebel.gemeinkostenFaktor,
    verwaltungProzent: profile.verwaltungProzent * hebel.gemeinkostenFaktor,
    vertriebProzent: profile.vertriebProzent * hebel.gemeinkostenFaktor,
    gewinnzuschlagProzent:
      hebel.gewinnzuschlagProzent === null ? profile.gewinnzuschlagProzent : hebel.gewinnzuschlagProzent,
  };
}

/** Rohwarenkosten je Verkaufseinheit, aufgeschluesselt nach Zutat. */
export function berechneRohware(
  product: Product,
  preise: Map<string, IngredientPrice>,
  preisFaktor: number,
  anteilVon: (line: Product['recipe']['lines'][number]) => number = (l) => l.anteil,
): { zeilen: RohwarenZeile[]; summe: number; einsatzmengeG: number } {
  const faktor = einsatzFaktor(product.recipe.verlustQuote);
  const fuellmenge = Math.max(0, product.fuellmengeG.wert);
  const einsatzmengeG = fuellmenge * faktor;

  const zeilen: RohwarenZeile[] = product.recipe.lines.map((line) => {
    const anteil = anteilVon(line);
    const grammJeVe = (anteil / 100) * einsatzmengeG;
    const treffer = findePreis(preise, line.ingredientId, line.qualitaet, product.staffel);
    const preisJeKg = treffer.preisJeKg * preisFaktor;
    return {
      lineId: line.id,
      name: line.etikettName,
      anteil,
      grammJeVe,
      preisJeKg,
      kostenJeVe: (grammJeVe / 1000) * preisJeKg,
      anteilAnRohware: 0,
      konfidenz: line.konfidenz,
      preisBekannt: treffer.gefunden,
    };
  });

  const summe = zeilen.reduce((s, z) => s + z.kostenJeVe, 0);
  for (const z of zeilen) z.anteilAnRohware = summe > 0 ? z.kostenJeVe / summe : 0;
  zeilen.sort((a, b) => b.kostenJeVe - a.kostenJeVe);
  return { zeilen, summe, einsatzmengeG };
}

interface Zwischenwerte {
  materialeinzelkosten: number;
  herstellkosten: number;
  vollkosten: number;
  abgabepreis: number;
  positionen: KostenPosition[];
}

/** Fuehrt das Zuschlagsschema ab den Materialeinzelkosten durch. */
function schema(
  rohwarenkosten: number,
  verpackungskosten: number,
  p: CostingProfile,
  detail: boolean,
): Zwischenwerte {
  const positionen: KostenPosition[] = [];
  const add = (
    schluessel: string,
    label: string,
    betrag: number,
    herleitung: string,
    extra: Partial<KostenPosition> = {},
  ) => {
    if (detail) positionen.push({ schluessel, label, betrag, herleitung, ...extra });
  };

  add('rohware', 'Rohwarenkosten', rohwarenkosten, 'Summe aller Zutaten × Einsatzmenge × Rohstoffpreis');
  add('verpackung', 'Verpackungskosten', verpackungskosten, 'Primär-, Sekundär- und Tertiärverpackung inkl. Lizenzentgelt');

  const materialeinzelkosten = rohwarenkosten + verpackungskosten;
  add('mek', 'Materialeinzelkosten', materialeinzelkosten, 'Rohware + Verpackung', { summe: true });

  const mgk = materialeinzelkosten * (p.materialGemeinkostenProzent / 100);
  add('mgk', 'Materialgemeinkosten', mgk, `${prozent(p.materialGemeinkostenProzent)} auf Materialeinzelkosten (Einkauf, Wareneingang, Lagerhaltung Rohstoffe)`, {
    basis: materialeinzelkosten,
    satz: p.materialGemeinkostenProzent,
  });

  const ausbringung = Math.max(1, p.ausbringungJeStunde);
  const fek = (p.personalkostenJeStunde * p.personenJeLinie) / ausbringung;
  add('fek', 'Fertigungseinzelkosten', fek, `${euro(p.personalkostenJeStunde)}/h × ${zahl(p.personenJeLinie, 0)} Personen ÷ ${zahl(ausbringung, 0)} VE/h`);

  const maschine = (p.maschinenstundensatz + p.energieJeStunde) / ausbringung;
  const ruest = p.ruestkostenJeLos / Math.max(1, p.losgroesseVe);
  const fgk = maschine + ruest;
  add('fgk', 'Fertigungsgemeinkosten', fgk, `Maschinenstundensatz ${euro(p.maschinenstundensatz)} + Energie ${euro(p.energieJeStunde)} je Stunde ÷ ${zahl(ausbringung, 0)} VE/h = ${euroAuto(maschine)}; Rüstkosten ${euro(p.ruestkostenJeLos)} ÷ Losgröße ${zahl(p.losgroesseVe, 0)} VE = ${euroAuto(ruest)}`);

  const herstellkosten = materialeinzelkosten + mgk + fek + fgk;
  add('hk', 'Herstellkosten', herstellkosten, 'Materialeinzel- + Materialgemein- + Fertigungseinzel- + Fertigungsgemeinkosten', { summe: true });

  const qs = herstellkosten * (p.qualitaetProzent / 100);
  add('qs', 'Qualitätssicherung & Labor', qs, `${prozent(p.qualitaetProzent)} auf Herstellkosten`, { basis: herstellkosten, satz: p.qualitaetProzent });

  const fue = herstellkosten * (p.fuEProzent / 100);
  add('fue', 'Forschung & Entwicklung', fue, `${prozent(p.fuEProzent)} auf Herstellkosten`, { basis: herstellkosten, satz: p.fuEProzent });

  const verwaltung = herstellkosten * (p.verwaltungProzent / 100);
  add('verwaltung', 'Verwaltungsgemeinkosten', verwaltung, `${prozent(p.verwaltungProzent)} auf Herstellkosten`, { basis: herstellkosten, satz: p.verwaltungProzent });

  const vertrieb = herstellkosten * (p.vertriebProzent / 100);
  add('vertrieb', 'Vertriebsgemeinkosten', vertrieb, `${prozent(p.vertriebProzent)} auf Herstellkosten`, { basis: herstellkosten, satz: p.vertriebProzent });

  const logistik = p.logistikJePalette / Math.max(1, p.vePalette) + p.logistikJeVe;
  add('logistik', 'Logistik & Lagerung', logistik, `${euro(p.logistikJePalette)} je Palette ÷ ${zahl(p.vePalette, 0)} VE + ${euroAuto(p.logistikJeVe)} je VE`);

  const vollkosten = herstellkosten + qs + fue + verwaltung + vertrieb + logistik;
  add('vollkosten', 'Vollkosten (Selbstkosten)', vollkosten, 'Herstellkosten + QS + F&E + Verwaltung + Vertrieb + Logistik', { summe: true });

  const gewinn = vollkosten * (p.gewinnzuschlagProzent / 100);
  add('gewinn', 'Gewinnzuschlag', gewinn, `${prozent(p.gewinnzuschlagProzent)} auf Vollkosten`, { basis: vollkosten, satz: p.gewinnzuschlagProzent });

  const abgabepreis = vollkosten + gewinn;
  add('abgabepreis', 'Kalkulatorischer Abgabepreis', abgabepreis, 'Vollkosten + Gewinnzuschlag', { summe: true });

  return { materialeinzelkosten, herstellkosten, vollkosten, abgabepreis, positionen };
}

/** Vorwaertsrechnung von der Herstellerabgabe bis zum Verbraucherpreis. */
export function berechneHandel(abgabepreis: number, p: CostingProfile): HandelsRechnung {
  const konditionenSatz =
    (p.grundrabattProzent + p.zentralregulierungProzent + p.wkzProzent + p.bonusProzent) / 100;
  const konditionen = abgabepreis * konditionenSatz;
  const nettoNettoEk = abgabepreis - konditionen;
  const spanne = Math.min(0.95, Math.max(0, p.handelsspanneProzent / 100));
  // Handelsspanne wird auf den Netto-Verkaufspreis bezogen (Handelskalkulation).
  const vkNetto = nettoNettoEk / (1 - spanne);
  const handelsspanne = vkNetto - nettoNettoEk;
  const mehrwertsteuer = vkNetto * (p.mehrwertsteuerProzent / 100);
  return {
    bruttolistenpreis: abgabepreis,
    konditionen,
    nettoNettoEk,
    handelsspanne,
    vkNetto,
    mehrwertsteuer,
    vkBrutto: vkNetto + mehrwertsteuer,
  };
}

/** Rueckwaertsrechnung vom Regalpreis auf den impliziten Abgabepreis. */
export function berechneRueckwaerts(
  vkBrutto: number,
  p: CostingProfile,
  vollkosten: number,
  vollkostenMin: number,
  vollkostenMax: number,
): Rueckwaertsrechnung {
  const vkNetto = vkBrutto / (1 + p.mehrwertsteuerProzent / 100);
  const spanne = Math.min(0.95, Math.max(0, p.handelsspanneProzent / 100));
  const nettoNettoEk = vkNetto * (1 - spanne);
  const konditionenSatz = Math.min(
    0.9,
    (p.grundrabattProzent + p.zentralregulierungProzent + p.wkzProzent + p.bonusProzent) / 100,
  );
  const impliziterBlp = nettoNettoEk / (1 - konditionenSatz);

  const margeAbsolut = impliziterBlp - vollkosten;
  const margeProzent = impliziterBlp > 0 ? (margeAbsolut / impliziterBlp) * 100 : 0;
  const margeMinProzent = impliziterBlp > 0 ? ((impliziterBlp - vollkostenMax) / impliziterBlp) * 100 : 0;
  const margeMaxProzent = impliziterBlp > 0 ? ((impliziterBlp - vollkostenMin) / impliziterBlp) * 100 : 0;

  return {
    vkBrutto,
    vkNetto,
    nettoNettoEk,
    impliziterBlp,
    vollkosten,
    margeAbsolut,
    margeProzent,
    margeMinProzent,
    margeMaxProzent,
  };
}

/** Gesamtkonfidenz aus Rezeptur-, Preis- und Verpackungssicherheit. */
function gesamtKonfidenz(product: Product, zeilen: RohwarenZeile[]): number {
  const fit = product.recipe.fit?.guete ?? 0.35;

  let gewichteteKonfidenz = 0;
  let gewicht = 0;
  let ohnePreis = 0;
  for (const z of zeilen) {
    const g = Math.max(z.anteilAnRohware, 0.01);
    gewichteteKonfidenz += z.konfidenz * g;
    gewicht += g;
    if (!z.preisBekannt) ohnePreis += g;
  }
  const rezeptur = gewicht > 0 ? gewichteteKonfidenz / gewicht : 0.3;
  const preisAbdeckung = gewicht > 0 ? 1 - ohnePreis / gewicht : 0;
  const verpackungGeschaetzt = product.packaging.filter((s) => s.geschaetzt).length;
  const verpackung = product.packaging.length
    ? 1 - 0.4 * (verpackungGeschaetzt / product.packaging.length)
    : 0.6;

  const wert = 0.34 * rezeptur + 0.26 * fit + 0.24 * preisAbdeckung + 0.16 * verpackung;
  return Math.max(0.05, Math.min(0.95, wert));
}

/** Fuehrt die vollstaendige Kalkulation durch. */
export function berechneKalkulation({
  product,
  profile,
  preise,
  hebel = NEUTRALE_HEBEL,
}: KalkulationsEingabe): Calculation {
  const p = wendeHebelAn(profile, hebel);

  const roh = berechneRohware(product, preise, hebel.rohstoffpreisFaktor);
  const verp = summiereVerpackung(product.packaging);
  const verpackungskosten = verp.gesamt * hebel.verpackungFaktor;

  const haupt = schema(roh.summe, verpackungskosten, p, true);

  // Bandbreite: Rohware einmal mit den unteren, einmal mit den oberen
  // Anteilsgrenzen der Rezeptur gerechnet.
  const unten = berechneRohware(product, preise, hebel.rohstoffpreisFaktor, (l) => l.min);
  const oben = berechneRohware(product, preise, hebel.rohstoffpreisFaktor, (l) => l.max);
  const vollkostenMin = schema(Math.min(unten.summe, roh.summe), verpackungskosten * 0.92, p, false).vollkosten;
  const vollkostenMax = schema(Math.max(oben.summe, roh.summe), verpackungskosten * 1.08, p, false).vollkosten;

  const handel = berechneHandel(haupt.abgabepreis, p);
  const rueckwaerts = product.regalpreis
    ? berechneRueckwaerts(product.regalpreis.wert, p, haupt.vollkosten, vollkostenMin, vollkostenMax)
    : null;

  return {
    produktId: product.id,
    berechnetAm: new Date().toISOString(),
    rohwaren: roh.zeilen,
    rohwarenkosten: roh.summe,
    einsatzmengeG: roh.einsatzmengeG,
    verpackungPositionen: verp.positionen.map((v) => ({
      spec: v.spec,
      kostenJeVe: v.kostenJeVe * hebel.verpackungFaktor,
    })),
    verpackungskosten,
    verpackungPrimaer: verp.primaer * hebel.verpackungFaktor,
    verpackungSekundaer: verp.sekundaer * hebel.verpackungFaktor,
    verpackungTertiaer: verp.tertiaer * hebel.verpackungFaktor,
    lizenzentgelt: verp.lizenz * hebel.verpackungFaktor,
    positionen: haupt.positionen,
    materialeinzelkosten: haupt.materialeinzelkosten,
    herstellkosten: haupt.herstellkosten,
    vollkosten: haupt.vollkosten,
    abgabepreis: haupt.abgabepreis,
    handel,
    rueckwaerts,
    konfidenz: gesamtKonfidenz(product, roh.zeilen),
    vollkostenMin,
    vollkostenMax,
  };
}

/** Stueckkosten je Jahresmenge – Losgroessenlogik. */
export interface LosgroessenSzenario {
  jahresmengeVe: number;
  losgroesseVe: number;
  herstellkosten: number;
  vollkosten: number;
  abgabepreis: number;
}

export const LOSGROESSEN_STUFEN = [50_000, 250_000, 1_000_000];

/**
 * Rechnet die Stueckkosten fuer mehrere Jahresmengen.
 * Angenommen wird, dass ein Los rund ein Zwoelftel der Jahresmenge umfasst,
 * mindestens aber die im Profil hinterlegte Mindestlosgroesse.
 */
export function berechneLosgroessen(
  eingabe: KalkulationsEingabe,
  stufen: number[] = LOSGROESSEN_STUFEN,
): LosgroessenSzenario[] {
  return stufen.map((jahresmenge) => {
    const losgroesse = Math.max(2000, Math.round(jahresmenge / 12));
    const profile: CostingProfile = { ...eingabe.profile, losgroesseVe: losgroesse };
    const calc = berechneKalkulation({ ...eingabe, profile });
    return {
      jahresmengeVe: jahresmenge,
      losgroesseVe: losgroesse,
      herstellkosten: calc.herstellkosten,
      vollkosten: calc.vollkosten,
      abgabepreis: calc.abgabepreis,
    };
  });
}

/** Kostentreiber-Ranking fuer den Wasserfall. */
export function topKostentreiber(calc: Calculation, anzahl = 5): RohwarenZeile[] {
  return calc.rohwaren.filter((z) => z.kostenJeVe > 0).slice(0, anzahl);
}

/** Zutat mit dem groessten Kostenanteil, fuer die Kernaussage im Export. */
export function nenneHauptTreiber(calc: Calculation): string {
  const top = calc.rohwaren[0];
  if (!top || top.kostenJeVe <= 0) return 'keine Rohware bewertet';
  return `${top.name} (${prozent(top.anteilAnRohware * 100)} der Rohwarenkosten)`;
}

/** Gruppiert die Rohwarenkosten nach Warengruppe (fuer den Vergleich). */
export function rohwareNachGruppe(calc: Calculation): { gruppe: string; kosten: number }[] {
  const map = new Map<string, number>();
  for (const z of calc.rohwaren) {
    const line = z.lineId;
    void line;
    map.set(z.name, (map.get(z.name) ?? 0) + z.kostenJeVe);
  }
  return [...map.entries()].map(([gruppe, kosten]) => ({ gruppe, kosten }));
}

export function ingredientName(id: string | null): string {
  if (!id) return 'nicht zugeordnet';
  return INGREDIENT_BY_ID.get(id)?.name ?? id;
}
