import { describe, expect, it } from 'vitest';
import { parseZutatenliste } from './zutatenParser';
import { berechneNaehrwerte, berechneRezeptur, einsatzFaktor, setzeAnteil } from './rezeptur';
import { KATEGORIE_BY_ID, findeKategorie } from '../data/kategorien';
import { INGREDIENT_BY_ID } from '../data/ingredients';
import type { Naehrwerte } from './types';

const muesli = KATEGORIE_BY_ID.get('muesli')!;
const keks = KATEGORIE_BY_ID.get('keks')!;

function summe(werte: number[]): number {
  return werte.reduce((s, v) => s + v, 0);
}

describe('parseZutatenliste', () => {
  it('liest Reihenfolge, QUID und zusammengesetzte Zutaten', () => {
    const z = parseZutatenliste(
      'Zutaten: Haferflocken 62 %, Zucker, Sonnenblumenöl, Haselnüsse 4,5 %, Schokolade (Zucker, Kakaomasse, Kakaobutter), Salz.',
    );
    expect(z).toHaveLength(6);
    expect(z[0].etikettName).toBe('Haferflocken');
    expect(z[0].quid).toBe(62);
    expect(z[0].position).toBe(0);
    expect(z[3].quid).toBeCloseTo(4.5);
    expect(z[4].unterzutaten).toEqual(['Zucker', 'Kakaomasse', 'Kakaobutter']);
    expect(z[5].ingredientId).toBe('salz');
  });

  it('trennt nicht innerhalb von Klammern', () => {
    const z = parseZutatenliste('Weizenmehl, Emulgator (Lecithine, Mono- und Diglyceride), Salz');
    expect(z).toHaveLength(3);
    expect(z[1].unterzutaten).toHaveLength(2);
  });

  it('erkennt Bio-Kennzeichnung und schneidet Spurenhinweise ab', () => {
    const z = parseZutatenliste('Dinkelmehl*, Rohrzucker*, Salz. Kann Spuren von Nüssen enthalten.');
    expect(z).toHaveLength(3);
    expect(z[0].qualitaet).toBe('bio');
    expect(z.every((x) => !/spuren/i.test(x.etikettName))).toBe(true);
  });

  it('ordnet Synonyme dem Stammsatz zu', () => {
    const z = parseZutatenliste('Weizenmehl Type 550, Speisesalz, natürliches Aroma');
    expect(z[0].ingredientId).toBe('weizenmehl');
    expect(z[1].ingredientId).toBe('salz');
    expect(z[2].ingredientId).toBe('aroma');
  });

  it('liefert für leeren Text eine leere Liste', () => {
    expect(parseZutatenliste('')).toEqual([]);
    expect(parseZutatenliste('   ')).toEqual([]);
  });
});

describe('berechneRezeptur – Grundregeln', () => {
  const zutaten = parseZutatenliste('Weizenmehl, Zucker, Pflanzenöl, Backtriebmittel, Salz');

  it('normiert die Anteile auf 100 %', () => {
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    expect(summe(r.lines.map((l) => l.anteil))).toBeCloseTo(100, 4);
  });

  it('hält die Reihenfolgeregel ein', () => {
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    for (let i = 1; i < r.lines.length; i++) {
      expect(r.lines[i].anteil).toBeLessThanOrEqual(r.lines[i - 1].anteil + 1e-6);
    }
  });

  it('respektiert die harte Obergrenze 100/i aus der Reihenfolge', () => {
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    r.lines.forEach((l, i) => {
      expect(l.anteil).toBeLessThanOrEqual(100 / (i + 1) + 1e-6);
    });
  });

  it('behandelt QUID-Angaben als unverrückbare Anker', () => {
    const mitQuid = parseZutatenliste('Haferflocken 62 %, Zucker, Sonnenblumenöl, Haselnüsse 4,5 %, Salz');
    const r = berechneRezeptur({ zutaten: mitQuid, naehrwerte: null, kategorie: muesli });
    expect(r.lines[0].anteil).toBeCloseTo(62, 6);
    expect(r.lines[0].fixiert).toBe(true);
    expect(r.lines[3].anteil).toBeCloseTo(4.5, 6);
    expect(summe(r.lines.map((l) => l.anteil))).toBeCloseTo(100, 4);
  });

  it('hält technologische Obergrenzen ein (Backtriebmittel, Salz)', () => {
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    const btm = r.lines.find((l) => l.ingredientId === 'backtriebmittel')!;
    const salz = r.lines.find((l) => l.ingredientId === 'salz')!;
    expect(btm.anteil).toBeLessThanOrEqual(INGREDIENT_BY_ID.get('backtriebmittel')!.maxAnteil);
    expect(salz.anteil).toBeLessThanOrEqual(INGREDIENT_BY_ID.get('salz')!.maxAnteil);
  });

  it('liefert für jede Zeile eine Bandbreite, die den Wert einschließt', () => {
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    for (const l of r.lines) {
      expect(l.min).toBeLessThanOrEqual(l.anteil + 1e-6);
      expect(l.max).toBeGreaterThanOrEqual(l.anteil - 1e-6);
      expect(l.konfidenz).toBeGreaterThan(0);
      expect(l.konfidenz).toBeLessThanOrEqual(1);
    }
  });

  it('ist deterministisch', () => {
    const a = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    const b = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    expect(a.lines.map((l) => l.anteil)).toEqual(b.lines.map((l) => l.anteil));
  });

  it('kommt mit einer leeren Zutatenliste zurecht', () => {
    const r = berechneRezeptur({ zutaten: [], naehrwerte: null, kategorie: keks });
    expect(r.lines).toEqual([]);
  });
});

describe('berechneRezeptur – Nährwertabgleich', () => {
  /**
   * Referenzfall: Rezeptur ist bekannt, daraus werden die Nährwerte exakt
   * erzeugt. Die Rückrechnung muss die Nährwerte wieder treffen.
   */
  function nwAus(anteile: [string, number][]): Naehrwerte {
    const profile = anteile.map(([id]) => INGREDIENT_BY_ID.get(id)!.naehrwerte);
    return berechneNaehrwerte(
      anteile.map(([, a]) => a),
      profile,
    );
  }

  it('trifft die Deklaration eines Knuspermüslis auf unter 15 % genau', () => {
    const echt: [string, number][] = [
      ['hafer', 58],
      ['zucker', 16],
      ['sonnenblumenoel', 11],
      ['haselnuss', 8],
      ['rosinen', 6],
      ['salz', 1],
    ];
    const deklariert = nwAus(echt);
    const zutaten = parseZutatenliste(
      'Haferflocken, Zucker, Sonnenblumenöl, Haselnüsse, Rosinen, Salz',
    );
    const r = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: muesli });

    expect(r.fit).toBeDefined();
    expect(r.fit!.maxAbweichungProzent).toBeLessThan(15);
    expect(summe(r.lines.map((l) => l.anteil))).toBeCloseTo(100, 4);
  });

  it('trifft die Deklaration eines Butterkekses auf unter 15 % genau', () => {
    const echt: [string, number][] = [
      ['weizenmehl', 52],
      ['zucker', 22],
      ['butter', 20],
      ['ei', 4],
      ['backtriebmittel', 1.2],
      ['salz', 0.8],
    ];
    const deklariert = nwAus(echt);
    const zutaten = parseZutatenliste('Weizenmehl, Zucker, Butter, Ei, Backtriebmittel, Salz');
    const r = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: keks });

    expect(r.fit!.maxAbweichungProzent).toBeLessThan(15);
  });

  it('nutzt QUID-Anker und Nährwerte gemeinsam', () => {
    const echt: [string, number][] = [
      ['hafer', 55],
      ['zucker', 19.5],
      ['rapsoel', 12],
      ['mandel', 12],
      ['salz', 1.5],
    ];
    const deklariert = nwAus(echt);
    const zutaten = parseZutatenliste('Haferflocken 55 %, Zucker, Rapsöl, Mandeln 12 %, Salz');
    const r = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: muesli });

    expect(r.lines[0].anteil).toBeCloseTo(55, 5);
    expect(r.lines[3].anteil).toBeCloseTo(12, 5);
    expect(r.fit!.maxAbweichungProzent).toBeLessThan(15);
  });

  it('verbessert die Güte gegenüber der Schätzung ohne Nährwerte', () => {
    const echt: [string, number][] = [
      ['weizenmehl', 45],
      ['zucker', 30],
      ['palmoel', 20],
      ['kakaopulver', 5],
    ];
    const deklariert = nwAus(echt);
    const zutaten = parseZutatenliste('Weizenmehl, Zucker, Palmöl, Kakaopulver');

    const ohne = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    const mit = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: keks });

    const abwOhne = Math.abs(
      berechneNaehrwerte(
        ohne.lines.map((l) => l.anteil),
        ohne.lines.map((l) => INGREDIENT_BY_ID.get(l.ingredientId!)!.naehrwerte),
      ).fett - deklariert.fett,
    );
    const abwMit = Math.abs(mit.fit!.berechnet.fett - deklariert.fett);
    expect(abwMit).toBeLessThanOrEqual(abwOhne + 1e-9);
    expect(mit.fit!.guete).toBeGreaterThan(0.5);
  });

  it('meldet die Restabweichung je Nährwert', () => {
    const deklariert = nwAus([
      ['weizenmehl', 60],
      ['zucker', 25],
      ['rapsoel', 15],
    ]);
    const zutaten = parseZutatenliste('Weizenmehl, Zucker, Rapsöl');
    const r = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: keks });
    expect(r.fit!.abweichung.fett).toBeDefined();
    expect(r.fit!.abweichungProzent.zucker).toBeDefined();
    expect(r.fit!.deklariert).toEqual(deklariert);
  });
});

describe('manuelle Korrektur', () => {
  it('fixiert den gesetzten Wert und normiert den Rest', () => {
    const zutaten = parseZutatenliste('Weizenmehl, Zucker, Pflanzenöl, Salz');
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: keks });
    const ziel = r.lines[1].id;
    const neu = setzeAnteil(r, ziel, 25, null, keks);

    const zeile = neu.lines.find((l) => l.id === ziel)!;
    expect(zeile.anteil).toBeCloseTo(25, 6);
    expect(zeile.fixiert).toBe(true);
    expect(summe(neu.lines.map((l) => l.anteil))).toBeCloseTo(100, 4);
  });

  it('lässt eine QUID-Zeile durch manuelle Änderung anderer Zeilen unberührt', () => {
    const zutaten = parseZutatenliste('Haferflocken 60 %, Zucker, Rapsöl, Salz');
    const r = berechneRezeptur({ zutaten, naehrwerte: null, kategorie: muesli });
    const neu = setzeAnteil(r, r.lines[2].id, 8, null, muesli);
    expect(neu.lines[0].anteil).toBeCloseTo(60, 5);
    expect(summe(neu.lines.map((l) => l.anteil))).toBeCloseTo(100, 4);
  });
});

describe('Ausbeute und Kategoriezuordnung', () => {
  it('erhöht die Einsatzmenge um den Produktionsverlust', () => {
    expect(einsatzFaktor(0)).toBeCloseTo(1);
    expect(einsatzFaktor(0.03)).toBeCloseTo(1 / 0.97, 6);
    expect(einsatzFaktor(0.05) * 100).toBeGreaterThan(100);
  });

  it('begrenzt unsinnige Verlustquoten', () => {
    expect(einsatzFaktor(-1)).toBeCloseTo(1);
    expect(Number.isFinite(einsatzFaktor(2))).toBe(true);
  });

  it('findet die Kategorie aus freiem Text', () => {
    expect(findeKategorie('Knuspermüsli Schoko').id).toBe('muesli');
    expect(findeKategorie('Tiefkühlpizza Salami').id).toBe('tk_pizza');
    expect(findeKategorie('irgendwas Unbekanntes').id).toBe('sonstige');
    expect(findeKategorie(null).id).toBe('sonstige');
  });
});

describe('Sammelbegriffe mit Klammerangabe', () => {
  it('zieht die konkrete Ölsorte dem Sammelbegriff vor', () => {
    const z = parseZutatenliste('Weizenmehl, Zucker, Pflanzenöl (Palm), Salz');
    expect(z[2].ingredientId).toBe('palmoel');
  });

  it('bleibt beim Sammelbegriff, wenn die Klammer nichts hergibt', () => {
    const z = parseZutatenliste('Weizenmehl, Pflanzenöl (nicht gehärtet), Salz');
    expect(z[1].ingredientId).toBe('pflanzenoel');
  });

  it('verbessert damit den Fettsäureabgleich', () => {
    const echt: [string, number][] = [
      ['weizenmehl', 55],
      ['zucker', 22],
      ['palmoel', 22],
      ['salz', 1],
    ];
    const deklariert = berechneNaehrwerte(
      echt.map((e) => e[1]),
      echt.map((e) => INGREDIENT_BY_ID.get(e[0])!.naehrwerte),
    );
    const zutaten = parseZutatenliste('Weizenmehl, Zucker, Pflanzenöl (Palm), Salz');
    const r = berechneRezeptur({ zutaten, naehrwerte: deklariert, kategorie: keks });
    expect(Math.abs(r.fit!.abweichungProzent.gesaettigt ?? 99)).toBeLessThan(15);
  });
});
