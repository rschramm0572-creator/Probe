import * as XLSX from 'xlsx';
import {
  NAEHRWERT_EINHEIT,
  NAEHRWERT_FELDER,
  NAEHRWERT_LABEL,
  QUALITAET_LABEL,
  STAFFEL_LABEL,
  VERPACKUNGSART_LABEL,
  PACKSTOFF_LABEL,
  einsatzFaktor,
  ingredientName,
  produktTitel,
} from '../costing';
import type { Calculation, CostingProfile, Product } from '../costing';
import { SCHAETZ_HINWEIS } from '../../components/basis';
import { speichereDatei } from './datei';

/**
 * Excel-Export mit lebenden Formeln.
 *
 * Das Blatt ist so gebaut, dass ein Einkäufer in der Verhandlungsvorbereitung
 * direkt weiterrechnen kann: Rohstoffpreise, Zuschlagssaetze und Losgroesse
 * stehen im Blatt "Annahmen", alle Zwischensummen sind Formeln darauf.
 */

const DRUCK_JE_FARBE_JE_KG = 0.42;

function spalte(index: number): string {
  let s = '';
  let i = index;
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function zelle(spaltenIndex: number, zeile1basiert: number): string {
  return `${spalte(spaltenIndex)}${zeile1basiert}`;
}

interface Annahme {
  schluessel: string;
  label: string;
  wert: number | string;
  einheit: string;
}

class Blattbauer {
  readonly zeilen: (string | number | null)[][] = [];
  readonly formeln: { adresse: string; formel: string; wert: number; format?: string }[] = [];

  zeile(werte: (string | number | null)[]): number {
    this.zeilen.push(werte);
    return this.zeilen.length; // 1-basierte Zeilennummer
  }

  leer(): number {
    return this.zeile([]);
  }

  /**
   * Setzt eine Formelzelle. Der zwischengespeicherte Wert ist Pflicht: ohne ihn
   * schreibt SheetJS die Formel gar nicht erst, und Programme, die beim Oeffnen
   * nicht neu rechnen, zeigen sonst leere Zellen.
   */
  formel(
    spaltenIndex: number,
    zeile1basiert: number,
    formel: string,
    wert: number,
    format?: string,
  ) {
    this.formeln.push({
      adresse: zelle(spaltenIndex, zeile1basiert),
      formel,
      wert: Number.isFinite(wert) ? wert : 0,
      format,
    });
  }

  bau(spaltenbreiten: number[]): XLSX.WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet(this.zeilen);
    for (const f of this.formeln) {
      ws[f.adresse] = { t: 'n', f: f.formel, v: f.wert, z: f.format ?? '0.0000' };
    }
    ws['!cols'] = spaltenbreiten.map((w) => ({ wch: w }));
    return ws;
  }
}

export function baueArbeitsmappe(
  product: Product,
  calc: Calculation,
  profile: CostingProfile,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // --- Blatt "Annahmen" ---------------------------------------------------
  const annahmen: Annahme[] = [
    { schluessel: 'fuellmenge', label: 'Füllmenge je Verkaufseinheit', wert: product.fuellmengeG.wert, einheit: 'g' },
    { schluessel: 'verlust', label: 'Produktionsverlust (Schwund, Backverlust)', wert: product.recipe.verlustQuote * 100, einheit: '%' },
    { schluessel: 'einsatz', label: 'Einsatzmenge je Verkaufseinheit', wert: product.fuellmengeG.wert * einsatzFaktor(product.recipe.verlustQuote), einheit: 'g' },
    { schluessel: 'staffel', label: 'Abnahmestaffel Rohstoffe', wert: STAFFEL_LABEL[product.staffel], einheit: '' },
    { schluessel: 'mgk', label: 'Materialgemeinkosten', wert: profile.materialGemeinkostenProzent, einheit: '%' },
    { schluessel: 'lohn', label: 'Personalkosten je Stunde', wert: profile.personalkostenJeStunde, einheit: '€/h' },
    { schluessel: 'personen', label: 'Personen je Linie', wert: profile.personenJeLinie, einheit: '' },
    { schluessel: 'ausbringung', label: 'Ausbringung je Stunde', wert: profile.ausbringungJeStunde, einheit: 'VE/h' },
    { schluessel: 'maschine', label: 'Maschinenstundensatz', wert: profile.maschinenstundensatz, einheit: '€/h' },
    { schluessel: 'energie', label: 'Energiekosten je Stunde', wert: profile.energieJeStunde, einheit: '€/h' },
    { schluessel: 'ruest', label: 'Rüstkosten je Los', wert: profile.ruestkostenJeLos, einheit: '€' },
    { schluessel: 'los', label: 'Losgröße', wert: profile.losgroesseVe, einheit: 'VE' },
    { schluessel: 'qs', label: 'Qualitätssicherung & Labor', wert: profile.qualitaetProzent, einheit: '%' },
    { schluessel: 'fue', label: 'Forschung & Entwicklung', wert: profile.fuEProzent, einheit: '%' },
    { schluessel: 'verwaltung', label: 'Verwaltungsgemeinkosten', wert: profile.verwaltungProzent, einheit: '%' },
    { schluessel: 'vertrieb', label: 'Vertriebsgemeinkosten', wert: profile.vertriebProzent, einheit: '%' },
    { schluessel: 'logPalette', label: 'Logistik je Palette', wert: profile.logistikJePalette, einheit: '€' },
    { schluessel: 'vePalette', label: 'Verkaufseinheiten je Palette', wert: profile.vePalette, einheit: 'VE' },
    { schluessel: 'logVe', label: 'Logistik je Verkaufseinheit', wert: profile.logistikJeVe, einheit: '€' },
    { schluessel: 'gewinn', label: 'Gewinnzuschlag', wert: profile.gewinnzuschlagProzent, einheit: '%' },
    { schluessel: 'grundrabatt', label: 'Grundrabatt', wert: profile.grundrabattProzent, einheit: '%' },
    { schluessel: 'zr', label: 'Zentralregulierung', wert: profile.zentralregulierungProzent, einheit: '%' },
    { schluessel: 'wkz', label: 'Werbekostenzuschuss', wert: profile.wkzProzent, einheit: '%' },
    { schluessel: 'bonus', label: 'Bonus', wert: profile.bonusProzent, einheit: '%' },
    { schluessel: 'spanne', label: 'Handelsspanne', wert: profile.handelsspanneProzent, einheit: '%' },
    { schluessel: 'mwst', label: 'Mehrwertsteuer', wert: profile.mehrwertsteuerProzent, einheit: '%' },
    { schluessel: 'druck', label: 'Druckkosten je Farbe und kg Packstoff', wert: DRUCK_JE_FARBE_JE_KG, einheit: '€' },
  ];

  const a = new Blattbauer();
  a.zeile(['Annahmenblatt']);
  a.zeile(['Alle Werte sind editierbar. Das Kalkulationsblatt rechnet automatisch neu.']);
  a.leer();
  a.zeile(['Annahme', 'Wert', 'Einheit']);
  const kopfZeile = a.zeilen.length;
  const adresse: Record<string, string> = {};
  annahmen.forEach((an, i) => {
    const z = a.zeile([an.label, an.wert, an.einheit]);
    adresse[an.schluessel] = `Annahmen!$B$${z}`;
    void i;
  });
  void kopfZeile;
  XLSX.utils.book_append_sheet(wb, a.bau([44, 14, 10]), 'Annahmen');

  // --- Blatt "Kalkulation" ------------------------------------------------
  const k = new Blattbauer();
  k.zeile(['KalkuLens – Kalkulationsblatt']);
  k.zeile(['Produkt', produktTitel(product)]);
  k.zeile(['Kategorie', product.kategorie.wert, 'Füllmenge', product.fuellmengeG.wert, 'g']);
  k.zeile([
    'EAN',
    product.ean?.wert ?? '—',
    'Verpackung',
    VERPACKUNGSART_LABEL[product.verpackungsart.wert],
  ]);
  k.zeile(['Erstellt am', new Date().toLocaleString('de-DE')]);
  k.zeile(['Gesamtkonfidenz', Math.round(calc.konfidenz * 100) / 100]);
  k.zeile([SCHAETZ_HINWEIS]);
  k.leer();

  // Rezeptur
  k.zeile(['REZEPTUR']);
  k.zeile([
    'Zutat laut Etikett',
    'Rohstoff',
    'Qualität',
    'Anteil %',
    'min %',
    'max %',
    'Konfidenz',
    'g je VE',
    '€ je kg',
    '€ je VE',
  ]);
  const rezepturStart = k.zeilen.length + 1;
  const zeilenNachId = new Map(calc.rohwaren.map((r) => [r.lineId, r]));
  for (const line of product.recipe.lines) {
    const r = zeilenNachId.get(line.id);
    const z = k.zeile([
      line.etikettName,
      ingredientName(line.ingredientId),
      QUALITAET_LABEL[line.qualitaet],
      Math.round(line.anteil * 1000) / 1000,
      Math.round(line.min * 1000) / 1000,
      Math.round(line.max * 1000) / 1000,
      Math.round(line.konfidenz * 100) / 100,
      null,
      Math.round((r?.preisJeKg ?? 0) * 10000) / 10000,
      null,
    ]);
    // g je VE = Anteil % / 100 × Einsatzmenge
    k.formel(7, z, `D${z}/100*${adresse.einsatz}`, r?.grammJeVe ?? 0, '0.00');
    // € je VE = g je VE / 1000 × Preis je kg
    k.formel(9, z, `H${z}/1000*I${z}`, r?.kostenJeVe ?? 0, '0.0000');
  }
  const rezepturEnde = k.zeilen.length;
  const rohwareZeile = k.zeile(['Summe Rohwarenkosten', null, null, null, null, null, null, null, null, null]);
  if (rezepturEnde >= rezepturStart) {
    const anteilSumme = product.recipe.lines.reduce((sum, l) => sum + l.anteil, 0);
    k.formel(3, rohwareZeile, `SUM(D${rezepturStart}:D${rezepturEnde})`, anteilSumme, '0.00');
    k.formel(7, rohwareZeile, `SUM(H${rezepturStart}:H${rezepturEnde})`, calc.einsatzmengeG, '0.00');
    k.formel(9, rohwareZeile, `SUM(J${rezepturStart}:J${rezepturEnde})`, calc.rohwarenkosten, '0.0000');
  }
  k.leer();

  // Verpackung
  k.zeile(['VERPACKUNG']);
  k.zeile([
    'Ebene',
    'Bezeichnung',
    'Packstoff',
    'Gewicht g',
    '€ je kg',
    'Druckfarben',
    'Lizenz € je kg',
    'Zusatz € je Stück',
    'VE je Packmittel',
    '€ je VE',
  ]);
  const verpackungStart = k.zeilen.length + 1;
  const verpackungKosten = new Map(calc.verpackungPositionen.map((v) => [v.spec.id, v.kostenJeVe]));
  for (const spec of product.packaging) {
    const z = k.zeile([
      { primaer: 'Primär', sekundaer: 'Sekundär', tertiaer: 'Tertiär' }[spec.ebene],
      spec.bezeichnung,
      PACKSTOFF_LABEL[spec.packstoff],
      spec.gewichtG * spec.menge,
      spec.materialPreisJeKg,
      spec.druckfarben,
      spec.lizenzJeKg,
      spec.zusatzKostenJeStueck * spec.menge,
      spec.vePro,
      null,
    ]);
    k.formel(
      9,
      z,
      `((D${z}/1000)*(E${z}+F${z}*${adresse.druck}+G${z})+H${z})/I${z}`,
      verpackungKosten.get(spec.id) ?? 0,
      '0.0000',
    );
  }
  const verpackungEnde = k.zeilen.length;
  const verpackungZeile = k.zeile(['Summe Verpackungskosten']);
  if (verpackungEnde >= verpackungStart) {
    k.formel(9, verpackungZeile, `SUM(J${verpackungStart}:J${verpackungEnde})`, calc.verpackungskosten, '0.0000');
  }
  k.leer();

  // Zuschlagskalkulation
  k.zeile(['ZUSCHLAGSKALKULATION', null, null, null, null, null, null, null, null, '€ je VE']);
  const schema: { label: string; formel: string; fett?: boolean }[] = [];
  const roh = `J${rohwareZeile}`;
  const verp = `J${verpackungZeile}`;

  const zeileFuer: Record<string, number> = {};
  const betrag = new Map(calc.positionen.map((p) => [p.schluessel, p.betrag]));
  const setze = (schluessel: string, label: string, formel: string, wert: number) => {
    const z = k.zeile([label]);
    zeileFuer[schluessel] = z;
    k.formel(9, z, formel, wert, '0.0000');
  };

  setze('rohware', 'Rohwarenkosten', roh, calc.rohwarenkosten);
  setze('verpackung', 'Verpackungskosten', verp, calc.verpackungskosten);
  setze('mek', '= Materialeinzelkosten', `J${zeileFuer.rohware}+J${zeileFuer.verpackung}`, calc.materialeinzelkosten);
  setze('mgk', '+ Materialgemeinkosten', `J${zeileFuer.mek}*${adresse.mgk}/100`, betrag.get('mgk') ?? 0);
  setze(
    'fek',
    '+ Fertigungseinzelkosten',
    `${adresse.lohn}*${adresse.personen}/${adresse.ausbringung}`,
    betrag.get('fek') ?? 0,
  );
  setze(
    'fgk',
    '+ Fertigungsgemeinkosten',
    `(${adresse.maschine}+${adresse.energie})/${adresse.ausbringung}+${adresse.ruest}/${adresse.los}`,
    betrag.get('fgk') ?? 0,
  );
  setze(
    'hk',
    '= HERSTELLKOSTEN',
    `J${zeileFuer.mek}+J${zeileFuer.mgk}+J${zeileFuer.fek}+J${zeileFuer.fgk}`,
    calc.herstellkosten,
  );
  setze('qs', '+ Qualitätssicherung & Labor', `J${zeileFuer.hk}*${adresse.qs}/100`, betrag.get('qs') ?? 0);
  setze('fue', '+ Forschung & Entwicklung', `J${zeileFuer.hk}*${adresse.fue}/100`, betrag.get('fue') ?? 0);
  setze('verwaltung', '+ Verwaltungsgemeinkosten', `J${zeileFuer.hk}*${adresse.verwaltung}/100`, betrag.get('verwaltung') ?? 0);
  setze('vertrieb', '+ Vertriebsgemeinkosten', `J${zeileFuer.hk}*${adresse.vertrieb}/100`, betrag.get('vertrieb') ?? 0);
  setze(
    'logistik',
    '+ Logistik & Lagerung',
    `${adresse.logPalette}/${adresse.vePalette}+${adresse.logVe}`,
    betrag.get('logistik') ?? 0,
  );
  setze(
    'vollkosten',
    '= VOLLKOSTEN (Selbstkosten)',
    `J${zeileFuer.hk}+J${zeileFuer.qs}+J${zeileFuer.fue}+J${zeileFuer.verwaltung}+J${zeileFuer.vertrieb}+J${zeileFuer.logistik}`,
    calc.vollkosten,
  );
  setze(
    'gewinn',
    '+ Gewinnzuschlag',
    `J${zeileFuer.vollkosten}*${adresse.gewinn}/100`,
    betrag.get('gewinn') ?? 0,
  );
  setze(
    'blp',
    '= Kalkulatorischer Abgabepreis (BLP)',
    `J${zeileFuer.vollkosten}+J${zeileFuer.gewinn}`,
    calc.abgabepreis,
  );
  void schema;
  k.leer();

  // Handelsstufe
  k.zeile(['HANDELSSTUFE', null, null, null, null, null, null, null, null, '€ je VE']);
  const handel = calc.handel;
  setze(
    'konditionen',
    '− Konditionen (Grundrabatt, ZR, WKZ, Bonus)',
    `J${zeileFuer.blp}*(${adresse.grundrabatt}+${adresse.zr}+${adresse.wkz}+${adresse.bonus})/100`,
    handel?.konditionen ?? 0,
  );
  setze(
    'nne',
    '= Netto-Netto-Einkaufspreis Handel',
    `J${zeileFuer.blp}-J${zeileFuer.konditionen}`,
    handel?.nettoNettoEk ?? 0,
  );
  setze(
    'vkNetto',
    '= Verbraucherabgabepreis netto',
    `J${zeileFuer.nne}/(1-${adresse.spanne}/100)`,
    handel?.vkNetto ?? 0,
  );
  setze('spanne', '  davon Handelsspanne', `J${zeileFuer.vkNetto}-J${zeileFuer.nne}`, handel?.handelsspanne ?? 0);
  setze('mwst', '+ Mehrwertsteuer', `J${zeileFuer.vkNetto}*${adresse.mwst}/100`, handel?.mehrwertsteuer ?? 0);
  setze(
    'vkBrutto',
    '= Verbraucherabgabepreis brutto',
    `J${zeileFuer.vkNetto}+J${zeileFuer.mwst}`,
    handel?.vkBrutto ?? 0,
  );

  if (product.regalpreis) {
    k.leer();
    k.zeile(['RÜCKWÄRTSKALKULATION AUS DEM REGALPREIS', null, null, null, null, null, null, null, null, '€ je VE']);
    const rp = k.zeile(['Erfasster Regalpreis (brutto)', null, null, null, null, null, null, null, null, product.regalpreis.wert]);
    zeileFuer.regal = rp;
    const rueck = calc.rueckwaerts;
    setze(
      'rNetto',
      'Verbraucherabgabepreis netto',
      `J${zeileFuer.regal}/(1+${adresse.mwst}/100)`,
      rueck?.vkNetto ?? 0,
    );
    setze(
      'rNne',
      'Netto-Netto-Einkaufspreis Handel',
      `J${zeileFuer.rNetto}*(1-${adresse.spanne}/100)`,
      rueck?.nettoNettoEk ?? 0,
    );
    setze(
      'rBlp',
      'Impliziter Abgabepreis des Herstellers',
      `J${zeileFuer.rNne}/(1-(${adresse.grundrabatt}+${adresse.zr}+${adresse.wkz}+${adresse.bonus})/100)`,
      rueck?.impliziterBlp ?? 0,
    );
    setze(
      'rMarge',
      'Geschätzte Herstellermarge absolut',
      `J${zeileFuer.rBlp}-J${zeileFuer.vollkosten}`,
      rueck?.margeAbsolut ?? 0,
    );
    const mz = k.zeile(['Geschätzte Herstellermarge in %']);
    k.formel(
      9,
      mz,
      `IF(J${zeileFuer.rBlp}=0,0,J${zeileFuer.rMarge}/J${zeileFuer.rBlp}*100)`,
      rueck?.margeProzent ?? 0,
      '0.0',
    );
  }

  k.leer();
  k.zeile(['BANDBREITE DER VOLLKOSTEN']);
  k.zeile(['untere Schätzung', null, null, null, null, null, null, null, null, Math.round(calc.vollkostenMin * 10000) / 10000]);
  k.zeile(['obere Schätzung', null, null, null, null, null, null, null, null, Math.round(calc.vollkostenMax * 10000) / 10000]);

  XLSX.utils.book_append_sheet(wb, k.bau([38, 26, 12, 10, 9, 9, 10, 10, 12, 12]), 'Kalkulation');

  // --- Blatt "Nährwerte" --------------------------------------------------
  const n = new Blattbauer();
  n.zeile(['Nährwertabgleich je 100 g']);
  n.zeile(['Die zurückgerechneten Werte entstehen aus der geschätzten Rezeptur.']);
  n.leer();
  n.zeile(['Nährwert', 'deklariert', 'zurückgerechnet', 'Abweichung', 'Abweichung %', 'Einheit']);
  const fit = product.recipe.fit;
  for (const feld of NAEHRWERT_FELDER) {
    n.zeile([
      NAEHRWERT_LABEL[feld],
      fit?.deklariert ? Math.round(fit.deklariert[feld] * 100) / 100 : '—',
      fit ? Math.round(fit.berechnet[feld] * 100) / 100 : '—',
      fit?.abweichung[feld] !== undefined ? Math.round(fit.abweichung[feld]! * 100) / 100 : '—',
      fit?.abweichungProzent[feld] !== undefined
        ? Math.round(fit.abweichungProzent[feld]! * 10) / 10
        : '—',
      NAEHRWERT_EINHEIT[feld],
    ]);
  }
  XLSX.utils.book_append_sheet(wb, n.bau([30, 14, 18, 14, 14, 10]), 'Nährwerte');

  return wb;
}

export function exportiereExcel(product: Product, calc: Calculation, profile: CostingProfile): void {
  const wb = baueArbeitsmappe(product, calc, profile);
  const puffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  speichereDatei(
    puffer,
    `${dateiname(product)}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

const UMLAUT_ERSATZ: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

/**
 * Dateiname fuer die Exporte.
 *
 * Bewusst reines ASCII: die Datei wandert per Mail durch die
 * Verhandlungsvorbereitung, und Umlaute im Dateinamen werden unterwegs von
 * Browsern, Mailclients und Dateisystemen unterschiedlich behandelt.
 */
export function dateiname(product: Product): string {
  const roh = produktTitel(product)
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUT_ERSATZ[c])
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const datum = new Date().toISOString().slice(0, 10);
  return `KalkuLens_${roh || 'Produkt'}_${datum}`;
}
