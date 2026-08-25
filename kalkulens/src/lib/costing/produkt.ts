import { findeKategorie, KATEGORIE_BY_ID } from '../data/kategorien';
import { naehrwerteAusExtraktion, naehrwertKonfidenz, type ExtraktionsErgebnis } from './extraktion';
import { profilId } from './profile';
import { berechneRezeptur } from './rezeptur';
import { schaetzeVerpackung } from './verpackung';
import { parseZutatenliste } from './zutatenParser';
import { geschaetzt, type Product } from './types';

/** Erzeugt eine ID, die auch ohne crypto.randomUUID stabil eindeutig ist. */
export function neueId(praefix: string): string {
  const zufall = Math.random().toString(36).slice(2, 10);
  return `${praefix}_${Date.now().toString(36)}${zufall}`;
}

/** Leeres Produkt fuer die manuelle Erfassung. */
export function neuesProdukt(): Product {
  const kategorie = KATEGORIE_BY_ID.get('sonstige')!;
  return {
    id: neueId('p'),
    erfasstAm: new Date().toISOString(),
    fotos: [],
    name: geschaetzt('', 0, 'nutzer'),
    marke: geschaetzt('', 0, 'nutzer'),
    hersteller: geschaetzt('', 0, 'nutzer'),
    herkunftsland: geschaetzt('', 0, 'nutzer'),
    kategorie: geschaetzt(kategorie.id, 0.3, 'geschaetzt'),
    haendler: '',
    fuellmengeG: geschaetzt(500, 0.2, 'geschaetzt', 'Standardannahme, bitte prüfen'),
    portionG: null,
    ean: null,
    zutatenText: geschaetzt('', 0, 'nutzer'),
    naehrwerte: null,
    verpackungsart: geschaetzt(kategorie.verpackungsart, 0.3, 'geschaetzt'),
    verpackungsMerkmale: [],
    siegel: [],
    regalpreis: null,
    recipe: { lines: [], verlustQuote: kategorie.verlustQuote },
    packaging: schaetzeVerpackung(kategorie.verpackungsart, 500),
    profileId: profilId(kategorie.id),
    staffel: 'kontrakt',
    jahresmengeVe: 250_000,
    notiz: '',
    analyseStatus: 'manuell',
  };
}

/**
 * Uebernimmt ein Extraktionsergebnis in ein Produkt und rechnet Rezeptur und
 * Verpackung neu. Vom Nutzer bereits bestaetigte Felder bleiben unangetastet.
 */
export function wendeExtraktionAn(basis: Product, e: ExtraktionsErgebnis): Product {
  const p: Product = { ...basis };

  const uebernehmen = <T>(
    alt: Product['name'] | null,
    feld: { wert: T | null; konfidenz: number },
  ) => {
    if (feld.wert === null || feld.wert === '') return null;
    if (alt && alt.quelle === 'nutzer' && alt.wert) return null;
    return geschaetzt(feld.wert, feld.konfidenz, 'foto' as const);
  };

  const name = uebernehmen(p.name, e.produktname);
  if (name) p.name = name as typeof p.name;
  const marke = uebernehmen(p.marke, e.marke);
  if (marke) p.marke = marke as typeof p.marke;
  const hersteller = uebernehmen(p.hersteller, e.hersteller);
  if (hersteller) p.hersteller = hersteller as typeof p.hersteller;
  const herkunft = uebernehmen(p.herkunftsland, e.herkunftsland);
  if (herkunft) p.herkunftsland = herkunft as typeof p.herkunftsland;

  const kategorie = findeKategorie(e.kategorie.wert ?? e.produktname.wert);
  if (p.kategorie.quelle !== 'nutzer') {
    p.kategorie = geschaetzt(kategorie.id, Math.max(e.kategorie.konfidenz, 0.4), 'foto', e.kategorie.wert ?? undefined);
    p.profileId = profilId(kategorie.id);
  }

  if (e.fuellmengeG.wert !== null && p.fuellmengeG.quelle !== 'nutzer') {
    p.fuellmengeG = geschaetzt(e.fuellmengeG.wert, e.fuellmengeG.konfidenz, 'foto');
  }
  if (e.portionG.wert !== null) {
    p.portionG = geschaetzt(e.portionG.wert, e.portionG.konfidenz, 'foto');
  }
  if (e.ean.wert) {
    p.ean = geschaetzt(e.ean.wert, e.ean.konfidenz, 'foto');
  }
  if (e.regalpreisEur.wert !== null && e.regalpreisEur.wert > 0) {
    p.regalpreis = geschaetzt(e.regalpreisEur.wert, e.regalpreisEur.konfidenz, 'foto');
  }
  if (e.zutatenText.wert && p.zutatenText.quelle !== 'nutzer') {
    p.zutatenText = geschaetzt(e.zutatenText.wert, e.zutatenText.konfidenz, 'foto');
  }

  const nw = naehrwerteAusExtraktion(e);
  if (nw && (!p.naehrwerte || p.naehrwerte.quelle !== 'nutzer')) {
    p.naehrwerte = geschaetzt(nw, naehrwertKonfidenz(e), 'foto');
  }

  if (e.verpackungsart.wert && p.verpackungsart.quelle !== 'nutzer') {
    p.verpackungsart = geschaetzt(e.verpackungsart.wert, e.verpackungsart.konfidenz, 'foto');
  }
  if (e.verpackungsMerkmale.length) p.verpackungsMerkmale = e.verpackungsMerkmale;
  if (e.siegel.length) p.siegel = e.siegel;

  p.analyseStatus = 'fertig';
  return rechneProduktNeu(p);
}

/**
 * Rechnet Rezeptur und Verpackungsvorschlag aus den aktuellen Stammdaten neu.
 * Bereits manuell angepasste Verpackungszeilen bleiben erhalten.
 */
export function rechneProduktNeu(p: Product): Product {
  const kategorie = KATEGORIE_BY_ID.get(p.kategorie.wert) ?? findeKategorie(p.kategorie.wert);
  const zutaten = parseZutatenliste(p.zutatenText.wert);
  const recipe = berechneRezeptur({
    zutaten,
    naehrwerte: p.naehrwerte?.wert ?? null,
    kategorie,
    bestehend: p.recipe.lines.length === zutaten.length ? p.recipe.lines : undefined,
    verlustQuote: p.recipe.verlustQuote,
  });

  const nurGeschaetzt = p.packaging.every((s) => s.geschaetzt);
  const packaging = nurGeschaetzt
    ? schaetzeVerpackung(p.verpackungsart.wert, p.fuellmengeG.wert, p.verpackungsMerkmale)
    : p.packaging;

  return { ...p, recipe, packaging };
}

/** Anzeigename mit sinnvollem Fallback. */
export function produktTitel(p: Product): string {
  const name = p.name.wert?.trim();
  const marke = p.marke.wert?.trim();
  if (name && marke) return `${marke} – ${name}`;
  return name || marke || 'Unbenanntes Produkt';
}
