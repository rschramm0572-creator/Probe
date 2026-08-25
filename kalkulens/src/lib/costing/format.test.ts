import { describe, expect, it } from 'vitest';
import { anteilProzent, euro, euroAuto, gramm, parseZahl, prozent, zahl } from './format';

/** Intl setzt vor die Waehrung ein schmales geschuetztes Leerzeichen. */
const glatt = (t: string) => t.replace(/\u00a0|\u202f/g, ' ');

describe('deutsche Zahlenformatierung', () => {
  it('formatiert Beträge mit Punkt als Tausender- und Komma als Dezimaltrennzeichen', () => {
    expect(glatt(euro(1234.56))).toBe('1.234,56 €');
    expect(glatt(euro(0.5))).toBe('0,50 €');
    expect(zahl(1234.5, 1)).toBe('1.234,5');
    expect(glatt(prozent(12.345))).toBe('12,3 %');
    expect(glatt(anteilProzent(0.815, 0))).toBe('82 %');
    expect(glatt(gramm(500, 0))).toBe('500 g');
  });

  it('zeigt sehr kleine Beträge mit vier Nachkommastellen', () => {
    expect(glatt(euroAuto(0.0042))).toBe('0,0042 €');
    expect(glatt(euroAuto(1.5))).toBe('1,50 €');
    expect(glatt(euroAuto(0))).toBe('0,00 €');
  });

  it('gibt für fehlende Werte einen Gedankenstrich aus', () => {
    expect(euro(null)).toBe('—');
    expect(zahl(undefined)).toBe('—');
    expect(prozent(Number.NaN)).toBe('—');
  });
});

describe('parseZahl', () => {
  it('liest deutsche Notation', () => {
    expect(parseZahl('1.234,56')).toBeCloseTo(1234.56);
    expect(parseZahl('3,29 €')).toBeCloseTo(3.29);
    expect(parseZahl('12,5 %')).toBeCloseTo(12.5);
    expect(parseZahl('1.000')).toBe(1000);
  });

  it('nimmt auch einen Punkt als Dezimaltrennzeichen an, wenn kein Komma da ist', () => {
    expect(parseZahl('3.29')).toBeCloseTo(3.29);
    expect(parseZahl('0.5')).toBeCloseTo(0.5);
    expect(parseZahl('-2.75')).toBeCloseTo(-2.75);
  });

  it('liest ganze Zahlen und leere Eingaben', () => {
    expect(parseZahl('750')).toBe(750);
    expect(parseZahl('')).toBeNull();
    expect(parseZahl('   ')).toBeNull();
    expect(parseZahl('keine Zahl')).toBeNull();
  });
});
