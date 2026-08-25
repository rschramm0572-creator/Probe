/**
 * Kern-Datenmodell von KalkuLens.
 *
 * Grundsatz: Jede Zahl, die nicht direkt vom Etikett abgelesen wurde, traegt
 * eine Herkunft (`Quelle`) und eine Konfidenz. Die UI unterscheidet geschaetzte
 * von bestaetigten Werten ausschliesslich anhand dieser Felder.
 */

/** Woher ein Wert stammt. Bestimmt die optische Kennzeichnung im UI. */
export type Quelle =
  | 'foto'        // aus der Bilderkennung uebernommen
  | 'nutzer'      // vom Nutzer bestaetigt oder eingegeben -> gilt als sicher
  | 'geschaetzt'  // aus Kategoriewissen/Heuristik abgeleitet
  | 'berechnet';  // aus anderen Werten hergeleitet

/** Ein Wert mit Unsicherheitsangabe. */
export interface Geschaetzt<T> {
  wert: T;
  konfidenz: number; // 0..1
  quelle: Quelle;
  hinweis?: string;
}

export function geschaetzt<T>(
  wert: T,
  konfidenz = 0.5,
  quelle: Quelle = 'geschaetzt',
  hinweis?: string,
): Geschaetzt<T> {
  return { wert, konfidenz, quelle, hinweis };
}

/** Schwelle, ab der ein Feld im UI zur Pruefung markiert wird. */
export const PRUEF_SCHWELLE = 0.7;

// ---------------------------------------------------------------------------
// Naehrwerte
// ---------------------------------------------------------------------------

/** Naehrwerte je 100 g. Energie in kJ, alles andere in g. */
export interface Naehrwerte {
  energieKj: number;
  fett: number;
  gesaettigt: number;
  kohlenhydrate: number;
  zucker: number;
  ballaststoffe: number;
  eiweiss: number;
  salz: number;
}

export const NAEHRWERT_FELDER: (keyof Naehrwerte)[] = [
  'energieKj',
  'fett',
  'gesaettigt',
  'kohlenhydrate',
  'zucker',
  'ballaststoffe',
  'eiweiss',
  'salz',
];

export const NAEHRWERT_LABEL: Record<keyof Naehrwerte, string> = {
  energieKj: 'Energie',
  fett: 'Fett',
  gesaettigt: 'davon gesättigte Fettsäuren',
  kohlenhydrate: 'Kohlenhydrate',
  zucker: 'davon Zucker',
  ballaststoffe: 'Ballaststoffe',
  eiweiss: 'Eiweiß',
  salz: 'Salz',
};

export const NAEHRWERT_EINHEIT: Record<keyof Naehrwerte, string> = {
  energieKj: 'kJ',
  fett: 'g',
  gesaettigt: 'g',
  kohlenhydrate: 'g',
  zucker: 'g',
  ballaststoffe: 'g',
  eiweiss: 'g',
  salz: 'g',
};

export const NULL_NAEHRWERTE: Naehrwerte = {
  energieKj: 0,
  fett: 0,
  gesaettigt: 0,
  kohlenhydrate: 0,
  zucker: 0,
  ballaststoffe: 0,
  eiweiss: 0,
  salz: 0,
};

// ---------------------------------------------------------------------------
// Rohstoffe
// ---------------------------------------------------------------------------

export type Qualitaetsstufe = 'standard' | 'bio' | 'zertifiziert';

export const QUALITAET_LABEL: Record<Qualitaetsstufe, string> = {
  standard: 'Standard',
  bio: 'Bio',
  zertifiziert: 'Zertifiziert',
};

/** Abnahmemenge, bestimmt die Preisstaffel. */
export type Mengenstaffel = 'kleinmenge' | 'kontrakt' | 'grosskontrakt';

export const STAFFEL_LABEL: Record<Mengenstaffel, string> = {
  kleinmenge: 'Kleinmenge (< 1 t)',
  kontrakt: 'Kontrakt (1–20 t)',
  grosskontrakt: 'Großkontrakt (> 20 t)',
};

/** Rohstoff-Stammsatz inkl. Naehrwertprofil je 100 g. */
export interface Ingredient {
  id: string;
  name: string;
  /** Synonyme und Etikettenschreibweisen fuer das Matching der Zutatenliste. */
  synonyme: string[];
  gruppe: IngredientGruppe;
  naehrwerte: Naehrwerte;
  /**
   * Typische Obergrenze des Gewichtsanteils in einem Fertigprodukt (%).
   * Backtriebmittel, Aromen und Emulgatoren liegen technologisch bei < 2 %.
   */
  maxAnteil: number;
  /** Untergrenze, wenn eine Zutat nur in Spuren sinnvoll ist (%). */
  minAnteil: number;
}

export type IngredientGruppe =
  | 'getreide'
  | 'zucker'
  | 'fett'
  | 'milch'
  | 'ei'
  | 'nuss'
  | 'frucht'
  | 'gemuese'
  | 'fleisch'
  | 'kakao'
  | 'staerke'
  | 'protein'
  | 'zusatzstoff'
  | 'gewuerz'
  | 'wasser'
  | 'sonstiges';

export const GRUPPE_LABEL: Record<IngredientGruppe, string> = {
  getreide: 'Getreide & Mahlerzeugnisse',
  zucker: 'Zucker & Süßungsmittel',
  fett: 'Fette & Öle',
  milch: 'Milcherzeugnisse',
  ei: 'Ei',
  nuss: 'Nüsse & Saaten',
  frucht: 'Früchte',
  gemuese: 'Gemüse',
  fleisch: 'Fleisch & Fisch',
  kakao: 'Kakao & Schokolade',
  staerke: 'Stärke & Bindemittel',
  protein: 'Proteine',
  zusatzstoff: 'Zusatz- & Hilfsstoffe',
  gewuerz: 'Gewürze & Aromen',
  wasser: 'Wasser',
  sonstiges: 'Sonstiges',
};

/** Preis eines Rohstoffs je kg, gestaffelt nach Menge. */
export interface IngredientPrice {
  ingredientId: string;
  qualitaet: Qualitaetsstufe;
  /** Preis je kg in EUR, je Mengenstaffel. */
  preisJeKg: Record<Mengenstaffel, number>;
  waehrung: 'EUR';
  gueltigAb: string; // ISO-Datum
  quelle: string;
}

// ---------------------------------------------------------------------------
// Rezeptur
// ---------------------------------------------------------------------------

export interface RecipeLine {
  id: string;
  /** Bezeichnung wie auf dem Etikett. */
  etikettName: string;
  /** Zugeordneter Stammsatz, falls das Matching gegriffen hat. */
  ingredientId: string | null;
  /** Geschaetzter Gewichtsanteil am Fertigprodukt in %. */
  anteil: number;
  min: number;
  max: number;
  konfidenz: number;
  /** Aus QUID deklarierter Anteil (%) – harter Ankerpunkt. */
  quid: number | null;
  /** Vom Nutzer fixiert: wird bei der Optimierung nicht mehr veraendert. */
  fixiert: boolean;
  /** Zusammengesetzte Zutat, z. B. "Schokolade (Zucker, Kakaomasse)". */
  unterzutaten?: string[];
  qualitaet: Qualitaetsstufe;
}

export interface Recipe {
  lines: RecipeLine[];
  /**
   * Produktionsbedingte Verlustquote (Schwund, Back-/Trocknungsverlust) als
   * Anteil der Einsatzmenge, 0..0,5. Standard 2–5 %, kategorieabhaengig.
   */
  verlustQuote: number;
  /** Abweichung der zurueckgerechneten Naehrwerte von der Deklaration. */
  fit?: RezepturFit;
}

export interface RezepturFit {
  berechnet: Naehrwerte;
  deklariert: Naehrwerte | null;
  /** Absolute Abweichung je Naehrwert (berechnet − deklariert). */
  abweichung: Partial<Naehrwerte>;
  /** Relative Abweichung je Naehrwert in % der Deklaration. */
  abweichungProzent: Partial<Naehrwerte>;
  /** Groesste relative Abweichung ueber alle Naehrwerte, in %. */
  maxAbweichungProzent: number;
  /** Gesamtguete 0..1 (1 = perfekte Uebereinstimmung). */
  guete: number;
}

// ---------------------------------------------------------------------------
// Verpackung
// ---------------------------------------------------------------------------

export type VerpackungsEbene = 'primaer' | 'sekundaer' | 'tertiaer';

export type Verpackungsart =
  | 'faltschachtel'
  | 'standbodenbeutel'
  | 'folienbeutel'
  | 'becher'
  | 'dose'
  | 'glas'
  | 'schlauchbeutel'
  | 'schale'
  | 'flasche'
  | 'sonstige';

export const VERPACKUNGSART_LABEL: Record<Verpackungsart, string> = {
  faltschachtel: 'Faltschachtel',
  standbodenbeutel: 'Standbodenbeutel',
  folienbeutel: 'Folienbeutel',
  becher: 'Becher',
  dose: 'Dose',
  glas: 'Glas',
  schlauchbeutel: 'Schlauchbeutel',
  schale: 'Schale (MAP)',
  flasche: 'Flasche (PET)',
  sonstige: 'Sonstige',
};

export type Packstoff =
  | 'karton'
  | 'wellpappe'
  | 'pp-folie'
  | 'pe-folie'
  | 'verbundfolie'
  | 'aluminium'
  | 'weissblech'
  | 'glas'
  | 'pet'
  | 'ps'
  | 'holz';

export const PACKSTOFF_LABEL: Record<Packstoff, string> = {
  karton: 'Faltschachtelkarton',
  wellpappe: 'Wellpappe',
  'pp-folie': 'PP-Folie',
  'pe-folie': 'PE-Folie',
  verbundfolie: 'Verbundfolie (PET/ALU/PE)',
  aluminium: 'Aluminium',
  weissblech: 'Weißblech',
  glas: 'Glas',
  pet: 'PET',
  ps: 'Polystyrol',
  holz: 'Holz',
};

export interface PackagingSpec {
  id: string;
  ebene: VerpackungsEbene;
  bezeichnung: string;
  packstoff: Packstoff;
  /** Materialgewicht je Stueck in g. */
  gewichtG: number;
  /** Materialpreis je kg in EUR. */
  materialPreisJeKg: number;
  /** Anzahl Druckfarben (0 = unbedruckt). */
  druckfarben: number;
  /** Zusatzkosten je Stueck fuer Konfektion, Zip, Fenster, Ventil etc. */
  zusatzKostenJeStueck: number;
  /**
   * Wie viele Verkaufseinheiten teilen sich dieses Packmittel?
   * Primaer = 1, Umkarton z. B. 12, Palette z. B. 720.
   */
  vePro: number;
  /** Menge dieses Packmittels je Gebinde (z. B. 4 Zwischenlagen je Palette). */
  menge: number;
  /** Lizenzentgelt Duales System je kg Material in EUR (0 bei Transportverp.). */
  lizenzJeKg: number;
  geschaetzt: boolean;
}

// ---------------------------------------------------------------------------
// Kalkulationsprofil (Zuschlagssaetze)
// ---------------------------------------------------------------------------

export interface CostingProfile {
  id: string;
  name: string;
  /** Kategorie, fuer die dieses Profil als Standard gilt. */
  kategorie: string | null;

  materialGemeinkostenProzent: number;

  /** Fertigungseinzelkosten: Personalkosten je Stunde und Ausbringung je Stunde. */
  personalkostenJeStunde: number;
  /** Verkaufseinheiten je Stunde (Linienleistung). */
  ausbringungJeStunde: number;
  /** Anzahl Personen an der Linie. */
  personenJeLinie: number;

  /** Fertigungsgemeinkosten: Maschinenstundensatz und Energie. */
  maschinenstundensatz: number;
  energieJeStunde: number;
  /** Ruestkosten je Los in EUR (degressiv auf die Losgroesse verteilt). */
  ruestkostenJeLos: number;
  /** Losgroesse in VE je Ruestvorgang. */
  losgroesseVe: number;

  qualitaetProzent: number;
  fuEProzent: number;
  verwaltungProzent: number;
  vertriebProzent: number;

  /** Logistik: Kosten je Palette und je VE. */
  logistikJePalette: number;
  logistikJeVe: number;
  vePalette: number;

  gewinnzuschlagProzent: number;

  // Handelsstufe (optionaler Block)
  grundrabattProzent: number;
  zentralregulierungProzent: number;
  wkzProzent: number;
  bonusProzent: number;
  handelsspanneProzent: number;
  mehrwertsteuerProzent: number;
}

// ---------------------------------------------------------------------------
// Produkt & Kalkulation
// ---------------------------------------------------------------------------

export interface ProductPhoto {
  id: string;
  /** Rolle des Fotos im Erfassungsablauf. */
  rolle: 'vorderseite' | 'zutaten' | 'naehrwerte' | 'rueckseite';
  /** Data-URL (JPEG, verkleinert). */
  dataUrl: string;
  erfasstAm: string;
}

export interface Siegel {
  name: string;
  konfidenz: number;
}

export interface Product {
  id: string;
  erfasstAm: string;
  fotos: ProductPhoto[];

  name: Geschaetzt<string>;
  marke: Geschaetzt<string>;
  hersteller: Geschaetzt<string>;
  herkunftsland: Geschaetzt<string>;
  kategorie: Geschaetzt<string>;
  haendler: string;

  fuellmengeG: Geschaetzt<number>;
  portionG: Geschaetzt<number> | null;
  ean: Geschaetzt<string> | null;

  zutatenText: Geschaetzt<string>;
  naehrwerte: Geschaetzt<Naehrwerte> | null;

  verpackungsart: Geschaetzt<Verpackungsart>;
  verpackungsMerkmale: string[];
  siegel: Siegel[];

  /** Am Regal abgelesener Verbraucherpreis inkl. MwSt. in EUR. */
  regalpreis: Geschaetzt<number> | null;

  recipe: Recipe;
  packaging: PackagingSpec[];
  profileId: string;
  /** Gewaehlte Abnahmestaffel fuer die Rohwarenpreise. */
  staffel: Mengenstaffel;
  /** Jahresmenge in VE fuer die Losgroessenlogik. */
  jahresmengeVe: number;

  notiz: string;
  /** Status der Vision-Analyse. */
  analyseStatus: 'offen' | 'laeuft' | 'fertig' | 'fehler' | 'manuell';
  analyseFehler?: string;
}

// ---------------------------------------------------------------------------
// Ergebnis der Kalkulation
// ---------------------------------------------------------------------------

export interface KostenPosition {
  schluessel: string;
  label: string;
  /** Betrag je Verkaufseinheit in EUR. */
  betrag: number;
  /** Kurze Herleitung fuer die Rueckverfolgung per Tap. */
  herleitung: string;
  /** Ist dieser Betrag eine Zwischensumme? */
  summe?: boolean;
  /** Fuer die Rueckverfolgung: worauf der Zuschlag gerechnet wurde. */
  basis?: number;
  satz?: number;
}

export interface RohwarenZeile {
  lineId: string;
  name: string;
  anteil: number;
  grammJeVe: number;
  preisJeKg: number;
  kostenJeVe: number;
  anteilAnRohware: number;
  konfidenz: number;
  preisBekannt: boolean;
}

export interface Calculation {
  produktId: string;
  berechnetAm: string;

  rohwaren: RohwarenZeile[];
  rohwarenkosten: number;
  einsatzmengeG: number;

  verpackungPositionen: { spec: PackagingSpec; kostenJeVe: number }[];
  verpackungskosten: number;
  verpackungPrimaer: number;
  verpackungSekundaer: number;
  verpackungTertiaer: number;
  lizenzentgelt: number;

  positionen: KostenPosition[];

  materialeinzelkosten: number;
  herstellkosten: number;
  vollkosten: number;
  abgabepreis: number;

  handel: HandelsRechnung | null;
  rueckwaerts: Rueckwaertsrechnung | null;

  /** Gesamtkonfidenz 0..1 aus Rezeptur-, Preis- und Verpackungssicherheit. */
  konfidenz: number;
  /** Bandbreite der Vollkosten aus den Min/Max-Anteilen der Rezeptur. */
  vollkostenMin: number;
  vollkostenMax: number;
}

export interface HandelsRechnung {
  bruttolistenpreis: number;
  konditionen: number;
  nettoNettoEk: number;
  handelsspanne: number;
  vkNetto: number;
  mehrwertsteuer: number;
  vkBrutto: number;
}

export interface Rueckwaertsrechnung {
  vkBrutto: number;
  vkNetto: number;
  nettoNettoEk: number;
  impliziterBlp: number;
  vollkosten: number;
  margeAbsolut: number;
  margeProzent: number;
  margeMinProzent: number;
  margeMaxProzent: number;
}

export interface Scenario {
  id: string;
  produktId: string;
  name: string;
  typ: 'best' | 'base' | 'worst' | 'frei';
  /** Multiplikatoren auf die Stellhebel. */
  hebel: Hebel;
  erstelltAm: string;
}

export interface Hebel {
  rohstoffpreisFaktor: number;
  verpackungFaktor: number;
  ausbringungFaktor: number;
  losgroesseFaktor: number;
  gemeinkostenFaktor: number;
  gewinnzuschlagProzent: number | null;
}

export const NEUTRALE_HEBEL: Hebel = {
  rohstoffpreisFaktor: 1,
  verpackungFaktor: 1,
  ausbringungFaktor: 1,
  losgroesseFaktor: 1,
  gemeinkostenFaktor: 1,
  gewinnzuschlagProzent: null,
};
