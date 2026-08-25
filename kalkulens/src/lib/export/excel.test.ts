import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { baueArbeitsmappe, dateiname } from './excel';
import { KATEGORIE_BY_ID } from '../data/kategorien';
import {
  berechneKalkulation,
  erzeugeStartpreise,
  geschaetzt,
  neuesProdukt,
  preisIndex,
  profilFuerKategorie,
  rechneProduktNeu,
} from '../costing';
import type { Product } from '../costing';

const muesli = KATEGORIE_BY_ID.get('muesli')!;
const profil = profilFuerKategorie(muesli);
const preise = preisIndex(erzeugeStartpreise());

function testprodukt(): Product {
  const p = neuesProdukt();
  return rechneProduktNeu({
    ...p,
    name: geschaetzt('Knuspermüsli Schoko', 1, 'nutzer'),
    marke: geschaetzt('Testmarke', 1, 'nutzer'),
    kategorie: geschaetzt('muesli', 1, 'nutzer'),
    fuellmengeG: geschaetzt(500, 1, 'nutzer'),
    regalpreis: geschaetzt(3.29, 1, 'nutzer'),
    zutatenText: geschaetzt(
      'Haferflocken 58 %, Zucker, Sonnenblumenöl, Haselnüsse 8 %, Rosinen, Salz',
      1,
      'nutzer',
    ),
    naehrwerte: geschaetzt(
      {
        energieKj: 1850,
        fett: 15,
        gesaettigt: 2.2,
        kohlenhydrate: 60,
        zucker: 18,
        ballaststoffe: 7,
        eiweiss: 9,
        salz: 0.4,
      },
      1,
      'nutzer',
    ),
  });
}

function mappe() {
  const produkt = testprodukt();
  const calc = berechneKalkulation({ product: produkt, profile: profil, preise });
  return { produkt, calc, wb: baueArbeitsmappe(produkt, calc, profil) };
}

function formelZellen(ws: XLSX.WorkSheet): [string, XLSX.CellObject][] {
  return Object.entries(ws).filter(
    (e): e is [string, XLSX.CellObject] =>
      !e[0].startsWith('!') && typeof e[1] === 'object' && e[1] !== null && 'f' in e[1],
  );
}

describe('Excel-Export', () => {
  it('legt die drei Blätter an', () => {
    const { wb } = mappe();
    expect(wb.SheetNames).toEqual(['Annahmen', 'Kalkulation', 'Nährwerte']);
  });

  it('schreibt lebende Formeln statt fester Werte', () => {
    const { wb } = mappe();
    const formeln = formelZellen(wb.Sheets['Kalkulation']);
    expect(formeln.length).toBeGreaterThan(20);
  });

  it('verweist aus dem Kalkulationsblatt auf das Annahmenblatt', () => {
    const { wb } = mappe();
    const verweise = formelZellen(wb.Sheets['Kalkulation']).filter((e) =>
      String(e[1].f).includes('Annahmen!'),
    );
    expect(verweise.length).toBeGreaterThan(5);
  });

  it('überlebt den Schreib-Lese-Durchlauf mit Formeln', () => {
    const { wb } = mappe();
    const puffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    const gelesen = XLSX.read(puffer, { type: 'buffer', cellFormula: true });
    expect(gelesen.SheetNames).toContain('Kalkulation');
    const formeln = formelZellen(gelesen.Sheets['Kalkulation']);
    expect(formeln.length).toBeGreaterThan(20);
  });

  it('enthält die Zwischensummen des Kalkulationsschemas', () => {
    const { wb } = mappe();
    const zeilen = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Kalkulation'], {
      header: 1,
      blankrows: true,
    });
    const ersteSpalte = zeilen.map((z) => z[0]);
    for (const begriff of [
      '= Materialeinzelkosten',
      '= HERSTELLKOSTEN',
      '= VOLLKOSTEN (Selbstkosten)',
      '= Kalkulatorischer Abgabepreis (BLP)',
      '= Netto-Netto-Einkaufspreis Handel',
    ]) {
      expect(ersteSpalte).toContain(begriff);
    }
  });

  it('führt die Rückwärtskalkulation nur bei erfasstem Regalpreis', () => {
    const { produkt, calc, wb } = mappe();
    const mitPreis = XLSX.utils
      .sheet_to_json<unknown[]>(wb.Sheets['Kalkulation'], { header: 1, blankrows: true })
      .map((z) => z[0]);
    expect(mitPreis).toContain('RÜCKWÄRTSKALKULATION AUS DEM REGALPREIS');

    const ohne = baueArbeitsmappe({ ...produkt, regalpreis: null }, calc, profil);
    const ohnePreis = XLSX.utils
      .sheet_to_json<unknown[]>(ohne.Sheets['Kalkulation'], { header: 1, blankrows: true })
      .map((z) => z[0]);
    expect(ohnePreis).not.toContain('RÜCKWÄRTSKALKULATION AUS DEM REGALPREIS');
  });

  it('enthält den Schätzhinweis', () => {
    const { wb } = mappe();
    const text = XLSX.utils
      .sheet_to_json<unknown[]>(wb.Sheets['Kalkulation'], { header: 1, blankrows: true })
      .flat()
      .join(' ');
    expect(text).toMatch(/Schätzung/);
  });

  it('erzeugt einen sprechenden Dateinamen ohne Sonderzeichen', () => {
    const { produkt } = mappe();
    const name = dateiname(produkt);
    expect(name).toBe(
      `KalkuLens_Testmarke-Knuspermuesli-Schoko_${new Date().toISOString().slice(0, 10)}`,
    );
    // Umlaute und Satzzeichen ueberleben den Weg durch Mail und Dateisystem nicht
    // zuverlaessig – der Name bleibt deshalb reines ASCII.
    expect(name).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
