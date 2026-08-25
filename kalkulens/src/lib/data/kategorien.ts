import type { IngredientGruppe, Verpackungsart } from '../costing/types';

/**
 * Kategoriewissen: typische Rezepturkorridore, Verlustquoten und
 * Fertigungsparameter je Produktkategorie.
 *
 * Die Korridore dienen zweierlei: als Startwerte fuer die Rezepturschaetzung
 * und als Plausibilitaetspruefung. Sie sind bewusst weit gefasst – enger als
 * die Realitaet zu tun waere Scheinpraezision.
 */

export interface Korridor {
  /** Gruppe oder konkrete Zutat, auf die der Korridor wirkt. */
  gruppe?: IngredientGruppe;
  ingredientId?: string;
  min: number;
  max: number;
  typisch: number;
}

export interface Kategorie {
  id: string;
  label: string;
  synonyme: string[];
  /** Produktionsbedingter Verlust (Schwund, Back-/Trocknungsverlust). */
  verlustQuote: number;
  korridore: Korridor[];
  verpackungsart: Verpackungsart;
  /** Fertigungsparameter fuer das Standard-Kalkulationsprofil. */
  ausbringungJeStunde: number;
  personenJeLinie: number;
  maschinenstundensatz: number;
  energieJeStunde: number;
  ruestkostenJeLos: number;
  losgroesseVe: number;
  /** Handelsspanne, die in dieser Warengruppe ueblich ist (%). */
  handelsspanneProzent: number;
  mehrwertsteuerProzent: number;
}

export const KATEGORIEN: Kategorie[] = [
  {
    id: 'muesli',
    label: 'Müsli & Cerealien',
    synonyme: ['müsli', 'muesli', 'granola', 'cerealien', 'knuspermüsli', 'porridge', 'haferbrei', 'flakes'],
    verlustQuote: 0.03,
    korridore: [
      { gruppe: 'getreide', min: 30, max: 85, typisch: 55 },
      { gruppe: 'zucker', min: 2, max: 30, typisch: 14 },
      { gruppe: 'fett', min: 0, max: 18, typisch: 7 },
      { gruppe: 'nuss', min: 0, max: 25, typisch: 8 },
      { gruppe: 'frucht', min: 0, max: 35, typisch: 10 },
      { gruppe: 'kakao', min: 0, max: 20, typisch: 0 },
      { gruppe: 'gewuerz', min: 0, max: 2, typisch: 0.4 },
    ],
    verpackungsart: 'faltschachtel',
    ausbringungJeStunde: 4800,
    personenJeLinie: 3,
    maschinenstundensatz: 210,
    energieJeStunde: 55,
    ruestkostenJeLos: 850,
    losgroesseVe: 25000,
    handelsspanneProzent: 30,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'backmischung',
    label: 'Backmischung',
    synonyme: ['backmischung', 'kuchenmischung', 'brotbackmischung', 'muffinmischung', 'waffelmischung'],
    verlustQuote: 0.02,
    korridore: [
      { gruppe: 'getreide', min: 30, max: 80, typisch: 55 },
      { gruppe: 'zucker', min: 5, max: 45, typisch: 28 },
      { gruppe: 'fett', min: 0, max: 20, typisch: 5 },
      { gruppe: 'staerke', min: 0, max: 25, typisch: 5 },
      { gruppe: 'kakao', min: 0, max: 20, typisch: 0 },
      { ingredientId: 'backtriebmittel', min: 0.5, max: 4, typisch: 2 },
      { ingredientId: 'salz', min: 0.1, max: 2, typisch: 0.6 },
    ],
    verpackungsart: 'faltschachtel',
    ausbringungJeStunde: 7200,
    personenJeLinie: 2,
    maschinenstundensatz: 165,
    energieJeStunde: 30,
    ruestkostenJeLos: 520,
    losgroesseVe: 30000,
    handelsspanneProzent: 32,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'dessertpulver',
    label: 'Dessert- & Puddingpulver',
    synonyme: ['dessertpulver', 'puddingpulver', 'pudding', 'creme', 'mousse', 'dessert', 'tortenguss'],
    verlustQuote: 0.02,
    korridore: [
      { gruppe: 'staerke', min: 15, max: 75, typisch: 45 },
      { gruppe: 'zucker', min: 10, max: 70, typisch: 40 },
      { gruppe: 'milch', min: 0, max: 40, typisch: 5 },
      { gruppe: 'kakao', min: 0, max: 25, typisch: 0 },
      { gruppe: 'gewuerz', min: 0, max: 3, typisch: 0.8 },
      { ingredientId: 'salz', min: 0, max: 2, typisch: 0.4 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 9000,
    personenJeLinie: 2,
    maschinenstundensatz: 140,
    energieJeStunde: 22,
    ruestkostenJeLos: 380,
    losgroesseVe: 40000,
    handelsspanneProzent: 35,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'fertigsosse',
    label: 'Fertigsoße & Sauce',
    synonyme: ['sauce', 'soße', 'sosse', 'ketchup', 'dressing', 'pesto', 'mayonnaise', 'passata', 'sugo'],
    verlustQuote: 0.04,
    korridore: [
      { gruppe: 'wasser', min: 0, max: 75, typisch: 35 },
      { gruppe: 'gemuese', min: 5, max: 80, typisch: 35 },
      { gruppe: 'fett', min: 0, max: 45, typisch: 8 },
      { gruppe: 'zucker', min: 0, max: 25, typisch: 6 },
      { gruppe: 'staerke', min: 0, max: 12, typisch: 3 },
      { ingredientId: 'salz', min: 0.3, max: 3, typisch: 1.2 },
      { gruppe: 'gewuerz', min: 0, max: 5, typisch: 1 },
    ],
    verpackungsart: 'glas',
    ausbringungJeStunde: 6000,
    personenJeLinie: 3,
    maschinenstundensatz: 230,
    energieJeStunde: 75,
    ruestkostenJeLos: 950,
    losgroesseVe: 20000,
    handelsspanneProzent: 33,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'tk_pizza',
    label: 'Tiefkühlpizza',
    synonyme: ['pizza', 'tiefkühlpizza', 'flammkuchen', 'tk-pizza', 'steinofenpizza'],
    verlustQuote: 0.05,
    korridore: [
      { gruppe: 'getreide', min: 20, max: 45, typisch: 32 },
      { gruppe: 'wasser', min: 8, max: 28, typisch: 18 },
      { gruppe: 'gemuese', min: 5, max: 30, typisch: 15 },
      { gruppe: 'milch', min: 5, max: 25, typisch: 14 },
      { gruppe: 'fett', min: 1, max: 12, typisch: 4 },
      { gruppe: 'fleisch', min: 0, max: 20, typisch: 0 },
      { ingredientId: 'salz', min: 0.3, max: 2.5, typisch: 1.1 },
      { ingredientId: 'hefe', min: 0.2, max: 3, typisch: 1 },
    ],
    verpackungsart: 'faltschachtel',
    ausbringungJeStunde: 3600,
    personenJeLinie: 6,
    maschinenstundensatz: 420,
    energieJeStunde: 180,
    ruestkostenJeLos: 1450,
    losgroesseVe: 18000,
    handelsspanneProzent: 28,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'keks',
    label: 'Kekse & Gebäck',
    synonyme: ['keks', 'kekse', 'biscuit', 'cookies', 'butterkeks', 'waffeln', 'gebäck', 'cracker', 'lebkuchen'],
    verlustQuote: 0.04,
    korridore: [
      { gruppe: 'getreide', min: 30, max: 70, typisch: 50 },
      { gruppe: 'zucker', min: 8, max: 40, typisch: 22 },
      { gruppe: 'fett', min: 8, max: 32, typisch: 19 },
      { gruppe: 'kakao', min: 0, max: 25, typisch: 0 },
      { gruppe: 'ei', min: 0, max: 12, typisch: 2 },
      { ingredientId: 'backtriebmittel', min: 0.2, max: 3, typisch: 1 },
      { ingredientId: 'salz', min: 0.1, max: 2, typisch: 0.7 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 5400,
    personenJeLinie: 3,
    maschinenstundensatz: 260,
    energieJeStunde: 95,
    ruestkostenJeLos: 780,
    losgroesseVe: 30000,
    handelsspanneProzent: 32,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'schokolade',
    label: 'Schokolade & Süßwaren',
    synonyme: ['schokolade', 'tafel', 'praline', 'riegel', 'bonbon', 'süßware', 'nussnougat', 'creme'],
    verlustQuote: 0.02,
    korridore: [
      { gruppe: 'zucker', min: 20, max: 60, typisch: 42 },
      { gruppe: 'kakao', min: 5, max: 60, typisch: 25 },
      { gruppe: 'milch', min: 0, max: 30, typisch: 15 },
      { gruppe: 'nuss', min: 0, max: 40, typisch: 5 },
      { gruppe: 'fett', min: 0, max: 35, typisch: 3 },
      { ingredientId: 'lecithin', min: 0.1, max: 1, typisch: 0.4 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 7200,
    personenJeLinie: 3,
    maschinenstundensatz: 290,
    energieJeStunde: 65,
    ruestkostenJeLos: 900,
    losgroesseVe: 35000,
    handelsspanneProzent: 30,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'nudeln',
    label: 'Teigwaren',
    synonyme: ['nudeln', 'pasta', 'spaghetti', 'penne', 'teigwaren', 'spätzle', 'fusilli'],
    verlustQuote: 0.02,
    korridore: [
      { gruppe: 'getreide', min: 70, max: 100, typisch: 92 },
      { gruppe: 'ei', min: 0, max: 25, typisch: 0 },
      { gruppe: 'wasser', min: 0, max: 15, typisch: 5 },
      { ingredientId: 'salz', min: 0, max: 2, typisch: 0.3 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 8400,
    personenJeLinie: 2,
    maschinenstundensatz: 190,
    energieJeStunde: 110,
    ruestkostenJeLos: 600,
    losgroesseVe: 40000,
    handelsspanneProzent: 30,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'snack',
    label: 'Salzige Snacks',
    synonyme: ['chips', 'snack', 'flips', 'nüsse', 'erdnussflips', 'tortilla', 'brezel', 'salzstangen', 'popcorn'],
    verlustQuote: 0.05,
    korridore: [
      { gruppe: 'getreide', min: 20, max: 90, typisch: 55 },
      { gruppe: 'gemuese', min: 0, max: 80, typisch: 0 },
      { gruppe: 'fett', min: 8, max: 40, typisch: 26 },
      { gruppe: 'nuss', min: 0, max: 60, typisch: 0 },
      { ingredientId: 'salz', min: 0.5, max: 4, typisch: 1.6 },
      { gruppe: 'gewuerz', min: 0, max: 8, typisch: 2 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 6600,
    personenJeLinie: 3,
    maschinenstundensatz: 250,
    energieJeStunde: 130,
    ruestkostenJeLos: 700,
    losgroesseVe: 30000,
    handelsspanneProzent: 34,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'suppe',
    label: 'Trockensuppe & Würzmittel',
    synonyme: ['suppe', 'brühe', 'bruehe', 'würzmittel', 'fix', 'fixprodukt', 'bouillon', 'gewürzmischung'],
    verlustQuote: 0.02,
    korridore: [
      { gruppe: 'staerke', min: 5, max: 55, typisch: 28 },
      { ingredientId: 'salz', min: 5, max: 45, typisch: 22 },
      { gruppe: 'gemuese', min: 0, max: 40, typisch: 12 },
      { gruppe: 'fett', min: 0, max: 25, typisch: 8 },
      { gruppe: 'gewuerz', min: 1, max: 30, typisch: 10 },
      { gruppe: 'getreide', min: 0, max: 40, typisch: 8 },
    ],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 10800,
    personenJeLinie: 2,
    maschinenstundensatz: 130,
    energieJeStunde: 20,
    ruestkostenJeLos: 340,
    losgroesseVe: 45000,
    handelsspanneProzent: 36,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'milchprodukt',
    label: 'Molkereiprodukt',
    synonyme: ['joghurt', 'quark', 'skyr', 'pudding gekühlt', 'sahne', 'käse', 'frischkäse', 'buttermilch'],
    verlustQuote: 0.03,
    korridore: [
      { gruppe: 'milch', min: 40, max: 100, typisch: 78 },
      { gruppe: 'zucker', min: 0, max: 20, typisch: 8 },
      { gruppe: 'frucht', min: 0, max: 30, typisch: 8 },
      { gruppe: 'staerke', min: 0, max: 6, typisch: 1 },
    ],
    verpackungsart: 'becher',
    ausbringungJeStunde: 14400,
    personenJeLinie: 3,
    maschinenstundensatz: 310,
    energieJeStunde: 90,
    ruestkostenJeLos: 700,
    losgroesseVe: 50000,
    handelsspanneProzent: 26,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'konserve',
    label: 'Konserve & Fertiggericht',
    synonyme: ['konserve', 'dose', 'eintopf', 'fertiggericht', 'ravioli', 'gulasch', 'bohnen', 'mais'],
    verlustQuote: 0.04,
    korridore: [
      { gruppe: 'wasser', min: 10, max: 60, typisch: 32 },
      { gruppe: 'gemuese', min: 5, max: 70, typisch: 30 },
      { gruppe: 'fleisch', min: 0, max: 40, typisch: 8 },
      { gruppe: 'getreide', min: 0, max: 40, typisch: 8 },
      { gruppe: 'fett', min: 0, max: 20, typisch: 4 },
      { ingredientId: 'salz', min: 0.2, max: 3, typisch: 1 },
    ],
    verpackungsart: 'dose',
    ausbringungJeStunde: 7200,
    personenJeLinie: 4,
    maschinenstundensatz: 340,
    energieJeStunde: 160,
    ruestkostenJeLos: 1100,
    losgroesseVe: 25000,
    handelsspanneProzent: 28,
    mehrwertsteuerProzent: 7,
  },
  {
    id: 'getraenk',
    label: 'Getränk',
    synonyme: ['getränk', 'saft', 'limonade', 'nektar', 'schorle', 'wasser', 'eistee', 'drink'],
    verlustQuote: 0.03,
    korridore: [
      { gruppe: 'wasser', min: 30, max: 98, typisch: 78 },
      { gruppe: 'frucht', min: 0, max: 70, typisch: 12 },
      { gruppe: 'zucker', min: 0, max: 15, typisch: 8 },
      { gruppe: 'gewuerz', min: 0, max: 2, typisch: 0.2 },
    ],
    verpackungsart: 'flasche',
    ausbringungJeStunde: 21600,
    personenJeLinie: 2,
    maschinenstundensatz: 380,
    energieJeStunde: 120,
    ruestkostenJeLos: 800,
    losgroesseVe: 80000,
    handelsspanneProzent: 25,
    mehrwertsteuerProzent: 19,
  },
  {
    id: 'sonstige',
    label: 'Sonstige Lebensmittel',
    synonyme: [],
    verlustQuote: 0.03,
    korridore: [],
    verpackungsart: 'folienbeutel',
    ausbringungJeStunde: 6000,
    personenJeLinie: 3,
    maschinenstundensatz: 220,
    energieJeStunde: 70,
    ruestkostenJeLos: 800,
    losgroesseVe: 25000,
    handelsspanneProzent: 30,
    mehrwertsteuerProzent: 7,
  },
];

export const KATEGORIE_BY_ID = new Map(KATEGORIEN.map((k) => [k.id, k]));

/** Ordnet einen frei erkannten Kategorietext einer hinterlegten Kategorie zu. */
export function findeKategorie(text: string | null | undefined): Kategorie {
  const fallback = KATEGORIE_BY_ID.get('sonstige')!;
  if (!text) return fallback;
  const t = text.toLowerCase();
  for (const k of KATEGORIEN) {
    if (k.id === 'sonstige') continue;
    if (t.includes(k.id) || t.includes(k.label.toLowerCase())) return k;
    for (const s of k.synonyme) {
      if (t.includes(s)) return k;
    }
  }
  return fallback;
}
