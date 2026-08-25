import { KATEGORIE_BY_ID, KATEGORIEN } from '../data/kategorien';
import type { Kategorie } from '../data/kategorien';
import type { CostingProfile } from './types';

/**
 * Kalkulationsprofile: alle Zuschlagssaetze an einem Ort, je Produktkategorie
 * speicherbar. Die Standardsaetze folgen den in der Lebensmittelindustrie
 * ueblichen Groessenordnungen und sind vollstaendig editierbar.
 */

export const STANDARD_SAETZE = {
  materialGemeinkostenProzent: 4,
  qualitaetProzent: 1,
  fuEProzent: 1.5,
  verwaltungProzent: 5,
  vertriebProzent: 6,
  gewinnzuschlagProzent: 8,
  personalkostenJeStunde: 34,
  logistikJePalette: 46,
  logistikJeVe: 0.004,
  vePalette: 720,
  grundrabattProzent: 3,
  zentralregulierungProzent: 2.5,
  wkzProzent: 4,
  bonusProzent: 3,
} as const;

export function profilFuerKategorie(kategorie: Kategorie): CostingProfile {
  return {
    id: `cp_${kategorie.id}`,
    name: `Standardprofil ${kategorie.label}`,
    kategorie: kategorie.id,
    materialGemeinkostenProzent: STANDARD_SAETZE.materialGemeinkostenProzent,
    personalkostenJeStunde: STANDARD_SAETZE.personalkostenJeStunde,
    ausbringungJeStunde: kategorie.ausbringungJeStunde,
    personenJeLinie: kategorie.personenJeLinie,
    maschinenstundensatz: kategorie.maschinenstundensatz,
    energieJeStunde: kategorie.energieJeStunde,
    ruestkostenJeLos: kategorie.ruestkostenJeLos,
    losgroesseVe: kategorie.losgroesseVe,
    qualitaetProzent: STANDARD_SAETZE.qualitaetProzent,
    fuEProzent: STANDARD_SAETZE.fuEProzent,
    verwaltungProzent: STANDARD_SAETZE.verwaltungProzent,
    vertriebProzent: STANDARD_SAETZE.vertriebProzent,
    logistikJePalette: STANDARD_SAETZE.logistikJePalette,
    logistikJeVe: STANDARD_SAETZE.logistikJeVe,
    vePalette: STANDARD_SAETZE.vePalette,
    gewinnzuschlagProzent: STANDARD_SAETZE.gewinnzuschlagProzent,
    grundrabattProzent: STANDARD_SAETZE.grundrabattProzent,
    zentralregulierungProzent: STANDARD_SAETZE.zentralregulierungProzent,
    wkzProzent: STANDARD_SAETZE.wkzProzent,
    bonusProzent: STANDARD_SAETZE.bonusProzent,
    handelsspanneProzent: kategorie.handelsspanneProzent,
    mehrwertsteuerProzent: kategorie.mehrwertsteuerProzent,
  };
}

/** Ein Startprofil je hinterlegter Kategorie. */
export function erzeugeStartprofile(): CostingProfile[] {
  return KATEGORIEN.map(profilFuerKategorie);
}

export function profilId(kategorieId: string): string {
  return `cp_${KATEGORIE_BY_ID.has(kategorieId) ? kategorieId : 'sonstige'}`;
}

/** Beschreibt die Zuschlagssaetze in einer Zeile – fuer Exporte und Tooltips. */
export function profilKurzfassung(p: CostingProfile): string {
  return [
    `MGK ${p.materialGemeinkostenProzent} %`,
    `QS ${p.qualitaetProzent} %`,
    `F&E ${p.fuEProzent} %`,
    `VwGK ${p.verwaltungProzent} %`,
    `VtGK ${p.vertriebProzent} %`,
    `Gewinn ${p.gewinnzuschlagProzent} %`,
  ].join(' · ');
}
