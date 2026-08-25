import { jsPDF } from 'jspdf';
import {
  euro,
  euroAuto,
  datumZeit,
  gramm,
  nenneHauptTreiber,
  produktTitel,
  profilKurzfassung,
  prozent,
  zahl,
  VERPACKUNGSART_LABEL,
  STAFFEL_LABEL,
} from '../costing';
import type { Calculation, CostingProfile, Product } from '../costing';
import { SCHAETZ_HINWEIS } from '../../components/basis';
import { KATEGORIE_BY_ID } from '../data/kategorien';
import { dateiname } from './excel';
import { speichereDatei } from './datei';

/**
 * Einseitiges Management-Summary als PDF.
 *
 * Bewusst clientseitig erzeugt: die Fotos und Kalkulationen verlassen das Gerät
 * nicht. Der Schaetzhinweis steht sichtbar im Fussbereich.
 */

const RAND = 14;
const BREITE = 210;
const HOEHE = 297;
const INHALT = BREITE - 2 * RAND;

const FARBE = {
  text: [15, 23, 42] as [number, number, number],
  grau: [100, 116, 139] as [number, number, number],
  linie: [203, 213, 225] as [number, number, number],
  blau: [42, 120, 214] as [number, number, number],
  schiefer: [51, 65, 85] as [number, number, number],
  hell: [241, 245, 249] as [number, number, number],
};

export function exportierePdf(product: Product, calc: Calculation, profile: CostingProfile): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = RAND;

  // Kopf
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...FARBE.text);
  doc.text('Kostenschätzung', RAND, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...FARBE.grau);
  doc.text('KalkuLens · Management-Summary', BREITE - RAND, y + 4, { align: 'right' });
  y += 8;
  linie(doc, y);
  y += 6;

  // Produktkopf mit Foto
  const foto = product.fotos.find((f) => f.rolle === 'vorderseite') ?? product.fotos[0];
  const fotoBreite = 30;
  const fotoHoehe = 38;
  if (foto) {
    try {
      doc.addImage(foto.dataUrl, 'JPEG', RAND, y, fotoBreite, fotoHoehe, undefined, 'FAST');
    } catch {
      // Ein nicht lesbares Foto darf den Export nicht verhindern.
    }
  }
  const textX = foto ? RAND + fotoBreite + 5 : RAND;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...FARBE.text);
  const titel = doc.splitTextToSize(produktTitel(product), INHALT - (textX - RAND));
  doc.text(titel, textX, y + 4);
  let ky = y + 4 + titel.length * 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...FARBE.grau);
  const stamm = [
    `Kategorie: ${KATEGORIE_BY_ID.get(product.kategorie.wert)?.label ?? product.kategorie.wert}`,
    `Füllmenge: ${gramm(product.fuellmengeG.wert, 0)}`,
    `Verpackung: ${VERPACKUNGSART_LABEL[product.verpackungsart.wert]}`,
    product.ean?.wert ? `EAN: ${product.ean.wert}` : null,
    product.hersteller.wert ? `Hersteller: ${product.hersteller.wert}` : null,
    `Beschaffung: ${STAFFEL_LABEL[product.staffel]}`,
    `Erfasst: ${datumZeit(product.erfasstAm)}`,
  ].filter(Boolean) as string[];
  for (const zeileText of stamm) {
    doc.text(zeileText, textX, ky);
    ky += 4;
  }
  y = Math.max(y + fotoHoehe, ky) + 4;

  // Kernaussagen
  const kacheln: { titel: string; wert: string; zusatz: string }[] = [
    {
      titel: 'Vollkosten je VE',
      wert: euro(calc.vollkosten),
      zusatz: `Spanne ${euro(calc.vollkostenMin)} – ${euro(calc.vollkostenMax)}`,
    },
    {
      titel: 'Herstellkosten',
      wert: euro(calc.herstellkosten),
      zusatz: `Rohware ${prozent((calc.rohwarenkosten / Math.max(calc.vollkosten, 1e-9)) * 100, 0)} der Vollkosten`,
    },
    {
      titel: 'Kalkulatorischer Abgabepreis',
      wert: euro(calc.abgabepreis),
      zusatz: `inkl. ${prozent(profile.gewinnzuschlagProzent)} Gewinnzuschlag`,
    },
  ];
  if (calc.rueckwaerts) {
    kacheln.push({
      titel: 'Geschätzte Herstellermarge',
      wert: prozent(calc.rueckwaerts.margeProzent),
      zusatz: `${euro(calc.rueckwaerts.margeAbsolut)} je VE · Spanne ${prozent(
        calc.rueckwaerts.margeMinProzent,
        0,
      )} – ${prozent(calc.rueckwaerts.margeMaxProzent, 0)}`,
    });
  }

  const spalten = kacheln.length;
  const kachelBreite = (INHALT - (spalten - 1) * 3) / spalten;
  kacheln.forEach((k, i) => {
    const x = RAND + i * (kachelBreite + 3);
    doc.setFillColor(...FARBE.hell);
    doc.roundedRect(x, y, kachelBreite, 20, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...FARBE.grau);
    doc.text(k.titel, x + 3, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...FARBE.text);
    doc.text(k.wert, x + 3, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...FARBE.grau);
    doc.text(doc.splitTextToSize(k.zusatz, kachelBreite - 6), x + 3, y + 16.5);
  });
  y += 25;

  // Kostenwasserfall
  abschnitt(doc, 'Kostenwasserfall je Verkaufseinheit', y);
  y += 5;
  y = zeichneWasserfall(doc, calc, y);
  y += 4;

  // Zwei Spalten: Rezeptur links, Kalkulationsschema rechts
  const spaltenBreite = (INHALT - 6) / 2;
  const startY = y;

  abschnitt(doc, 'Geschätzte Rezeptur je Verkaufseinheit', y, RAND, spaltenBreite);
  let ly = y + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...FARBE.grau);
  doc.text('Zutat laut Etikett', RAND, ly);
  doc.text('Anteil % (min–max)', RAND + spaltenBreite - 20, ly, { align: 'right' });
  doc.text('€ je VE', RAND + spaltenBreite, ly, { align: 'right' });
  ly += 1.2;
  doc.setDrawColor(...FARBE.linie);
  doc.line(RAND, ly, RAND + spaltenBreite, ly);
  ly += 3.2;

  const kosten = new Map(calc.rohwaren.map((r) => [r.lineId, r]));
  const zeilenHoehe = 3.6;
  // Rechts laufen 13 Schemazeilen; so viel Platz steht auch links zur Verfuegung.
  const platz = 13;
  const alleZeilen = product.recipe.lines;
  const passtVollstaendig = alleZeilen.length <= platz;
  const sichtbar = alleZeilen.slice(0, passtVollstaendig ? alleZeilen.length : platz - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  for (const line of sichtbar) {
    const r = kosten.get(line.id);
    doc.setTextColor(...FARBE.text);
    const name = line.quid !== null ? `${line.etikettName} (QUID)` : line.etikettName;
    doc.text(doc.splitTextToSize(name, spaltenBreite - 42)[0], RAND, ly);
    doc.text(
      `${zahl(line.anteil, 1)} (${zahl(line.min, 1)}–${zahl(line.max, 1)})`,
      RAND + spaltenBreite - 20,
      ly,
      { align: 'right' },
    );
    doc.text(zahl(r?.kostenJeVe ?? 0, 4), RAND + spaltenBreite, ly, { align: 'right' });
    ly += zeilenHoehe;
  }

  // Eine Kuerzung wird ausgewiesen, nicht verschwiegen.
  if (!passtVollstaendig) {
    const rest = alleZeilen.length - sichtbar.length;
    doc.setTextColor(...FARBE.grau);
    doc.text(
      `… ${zahl(rest, 0)} weitere mit zusammen ${zahl(
        alleZeilen.slice(sichtbar.length).reduce((sum, l) => sum + l.anteil, 0),
        1,
      )} % – vollständig im Excel-Blatt`,
      RAND,
      ly,
    );
    ly += zeilenHoehe;
  }

  if (alleZeilen.length === 0) {
    doc.setTextColor(...FARBE.grau);
    doc.text('Keine Zutatenliste erfasst.', RAND, ly);
    ly += zeilenHoehe;
  } else {
    doc.setDrawColor(...FARBE.linie);
    doc.line(RAND, ly - 1.4, RAND + spaltenBreite, ly - 1.4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...FARBE.text);
    doc.text('Summe Rohware', RAND, ly + 1.6);
    doc.text(
      `${zahl(
        alleZeilen.reduce((sum, l) => sum + l.anteil, 0),
        1,
      )}`,
      RAND + spaltenBreite - 20,
      ly + 1.6,
      { align: 'right' },
    );
    doc.text(zahl(calc.rohwarenkosten, 4), RAND + spaltenBreite, ly + 1.6, { align: 'right' });
    ly += 5;
  }

  const rechtsX = RAND + spaltenBreite + 6;
  abschnitt(doc, 'Kalkulationsschema', startY, rechtsX, spaltenBreite);
  let ry = startY + 5;
  doc.setFontSize(7.2);
  for (const pos of calc.positionen) {
    if (pos.schluessel === 'rohware' || pos.schluessel === 'verpackung') continue;
    doc.setFont('helvetica', pos.summe ? 'bold' : 'normal');
    doc.setTextColor(...(pos.summe ? FARBE.text : FARBE.grau));
    doc.text(doc.splitTextToSize(pos.label, spaltenBreite - 24)[0], rechtsX, ry);
    doc.setTextColor(...FARBE.text);
    doc.text(euroAuto(pos.betrag), rechtsX + spaltenBreite, ry, { align: 'right' });
    ry += 4.3;
  }

  y = Math.max(ly, ry) + 3;

  const fussY = HOEHE - RAND - 12;

  // Annahmenverzeichnis
  abschnitt(doc, 'Annahmenverzeichnis', y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...FARBE.grau);
  const annahmen = [
    `Zuschlagssätze: ${profilKurzfassung(profile)}`,
    `Fertigung: ${zahl(profile.ausbringungJeStunde, 0)} VE/h · ${zahl(profile.personenJeLinie, 0)} Personen · Maschinenstundensatz ${euro(profile.maschinenstundensatz)} · Rüstkosten ${euro(profile.ruestkostenJeLos)} je Los à ${zahl(profile.losgroesseVe, 0)} VE`,
    `Produktionsverlust: ${prozent(product.recipe.verlustQuote * 100)} · Einsatzmenge ${gramm(calc.einsatzmengeG, 0)} je VE`,
    `Handelsstufe: Konditionen ${prozent(profile.grundrabattProzent + profile.zentralregulierungProzent + profile.wkzProzent + profile.bonusProzent)} · Handelsspanne ${prozent(profile.handelsspanneProzent)} · MwSt. ${prozent(profile.mehrwertsteuerProzent, 0)}`,
    `Rezepturgüte: maximale Nährwertabweichung ${
      product.recipe.fit?.deklariert ? prozent(product.recipe.fit.maxAbweichungProzent) : 'keine Deklaration erfasst'
    } · Gesamtkonfidenz ${prozent(calc.konfidenz * 100, 0)}`,
    `Haupttreiber: ${nenneHauptTreiber(calc)}`,
  ];
  for (const a of annahmen) {
    const zeilen = doc.splitTextToSize(`•  ${a}`, INHALT);
    doc.text(zeilen, RAND, y);
    y += zeilen.length * 3.4 + 0.8;
  }

  doc.setDrawColor(...FARBE.linie);
  doc.line(RAND, fussY, BREITE - RAND, fussY);
  doc.setFontSize(6.8);
  doc.setTextColor(...FARBE.grau);
  doc.setFont('helvetica', 'bold');
  doc.text('Hinweis zum Schätzcharakter', RAND, fussY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(SCHAETZ_HINWEIS, INHALT), RAND, fussY + 7.5);

  speichereDatei(doc.output('blob'), `${dateiname(product)}.pdf`, 'application/pdf');
}

function linie(doc: jsPDF, y: number) {
  doc.setDrawColor(...FARBE.linie);
  doc.line(RAND, y, BREITE - RAND, y);
}

function abschnitt(doc: jsPDF, titel: string, y: number, x = RAND, breite = INHALT) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...FARBE.schiefer);
  doc.text(titel.toUpperCase(), x, y);
  doc.setDrawColor(...FARBE.linie);
  doc.line(x, y + 1.4, x + breite, y + 1.4);
}

/** Zeichnet den Wasserfall als schlichtes Balkendiagramm. */
function zeichneWasserfall(doc: jsPDF, calc: Calculation, y: number): number {
  const punkte = calc.positionen.filter(
    (p) => !['mek', 'abgabepreis', 'gewinn'].includes(p.schluessel),
  );
  if (punkte.length === 0) return y;

  const hoehe = 34;
  const basisY = y + hoehe;
  const spaltenBreite = INHALT / punkte.length;
  const balkenBreite = Math.min(spaltenBreite * 0.62, 12);
  const maxWert = Math.max(...punkte.map((p) => (p.summe ? p.betrag : 0)), calc.vollkosten);
  const skala = maxWert > 0 ? hoehe / (maxWert * 1.12) : 0;

  let lauf = 0;
  punkte.forEach((p, i) => {
    const x = RAND + i * spaltenBreite + (spaltenBreite - balkenBreite) / 2;
    let von: number;
    let bis: number;
    if (p.summe) {
      von = 0;
      bis = p.betrag;
      lauf = p.betrag;
    } else {
      von = lauf;
      bis = lauf + p.betrag;
      lauf = bis;
    }
    const oben = basisY - Math.max(von, bis) * skala;
    const balkenHoehe = Math.max(Math.abs(bis - von) * skala, 0.5);

    doc.setFillColor(...(p.summe ? FARBE.schiefer : FARBE.blau));
    doc.rect(x, oben, balkenBreite, balkenHoehe, 'F');

    doc.setFont('helvetica', p.summe ? 'bold' : 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...(p.summe ? FARBE.schiefer : FARBE.grau));
    const label = doc.splitTextToSize(kurzLabel(p.label), spaltenBreite + 2);
    doc.text(label.slice(0, 2), RAND + i * spaltenBreite + spaltenBreite / 2, basisY + 3, {
      align: 'center',
    });
    doc.setFontSize(5.8);
    doc.setTextColor(...FARBE.text);
    doc.text(zahl(p.betrag, 2), RAND + i * spaltenBreite + spaltenBreite / 2, oben - 1.2, {
      align: 'center',
    });
  });

  doc.setDrawColor(...FARBE.linie);
  doc.line(RAND, basisY, BREITE - RAND, basisY);
  return basisY + 9;
}

function kurzLabel(label: string): string {
  return label
    .replace('Rohwarenkosten', 'Rohware')
    .replace('Verpackungskosten', 'Verpackung')
    .replace('Materialgemeinkosten', 'Material-GK')
    .replace('Fertigungseinzelkosten', 'Fertigung EK')
    .replace('Fertigungsgemeinkosten', 'Fertigung GK')
    .replace('Verwaltungsgemeinkosten', 'Verwaltung')
    .replace('Vertriebsgemeinkosten', 'Vertrieb')
    .replace('Qualitätssicherung & Labor', 'QS & Labor')
    .replace('Forschung & Entwicklung', 'F&E')
    .replace('Vollkosten (Selbstkosten)', 'Vollkosten')
    .replace('Logistik & Lagerung', 'Logistik');
}
