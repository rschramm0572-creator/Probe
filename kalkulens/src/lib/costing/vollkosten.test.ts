import { describe, expect, it } from 'vitest';
import { KATEGORIE_BY_ID } from '../data/kategorien';
import { erzeugeStartpreise, preisIndex } from './preise';
import { profilFuerKategorie } from './profile';
import {
  berechneHandel,
  berechneKalkulation,
  berechneLosgroessen,
  berechneRueckwaerts,
  topKostentreiber,
  wendeHebelAn,
} from './vollkosten';
import { berechneTornado, stresstest, SZENARIO_VORLAGEN } from './sensitivitaet';
import { rechneProduktNeu, neuesProdukt } from './produkt';
import { schaetzeVerpackung, summiereVerpackung, kostenJeVe } from './verpackung';
import { geschaetzt, NEUTRALE_HEBEL, type CostingProfile, type Product } from './types';

const preise = preisIndex(erzeugeStartpreise());
const muesli = KATEGORIE_BY_ID.get('muesli')!;
const profil = profilFuerKategorie(muesli);

function testprodukt(overrides: Partial<Product> = {}): Product {
  const p = neuesProdukt();
  p.kategorie = geschaetzt('muesli', 0.9, 'nutzer');
  p.name = geschaetzt('Knuspermüsli Schoko', 0.9, 'nutzer');
  p.fuellmengeG = geschaetzt(500, 0.95, 'nutzer');
  p.zutatenText = geschaetzt(
    'Haferflocken 58 %, Zucker, Sonnenblumenöl, Haselnüsse 8 %, Rosinen, Salz',
    0.9,
    'nutzer',
  );
  p.naehrwerte = geschaetzt(
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
    0.9,
    'nutzer',
  );
  p.verpackungsart = geschaetzt('faltschachtel', 0.9, 'nutzer');
  p.profileId = profil.id;
  return rechneProduktNeu({ ...p, ...overrides });
}

function rechne(p: Product, profile: CostingProfile = profil) {
  return berechneKalkulation({ product: p, profile, preise });
}

describe('Zuschlagskalkulationsschema', () => {
  const calc = rechne(testprodukt());

  it('summiert Materialeinzelkosten aus Rohware und Verpackung', () => {
    expect(calc.materialeinzelkosten).toBeCloseTo(calc.rohwarenkosten + calc.verpackungskosten, 10);
  });

  it('bildet die Herstellkosten aus MEK, MGK, FEK und FGK', () => {
    const pos = Object.fromEntries(calc.positionen.map((p) => [p.schluessel, p.betrag]));
    expect(calc.herstellkosten).toBeCloseTo(pos.mek + pos.mgk + pos.fek + pos.fgk, 10);
  });

  it('bildet die Vollkosten aus Herstellkosten plus Zuschlägen', () => {
    const pos = Object.fromEntries(calc.positionen.map((p) => [p.schluessel, p.betrag]));
    expect(calc.vollkosten).toBeCloseTo(
      calc.herstellkosten + pos.qs + pos.fue + pos.verwaltung + pos.vertrieb + pos.logistik,
      10,
    );
  });

  it('rechnet den Abgabepreis als Vollkosten plus Gewinnzuschlag', () => {
    expect(calc.abgabepreis).toBeCloseTo(
      calc.vollkosten * (1 + profil.gewinnzuschlagProzent / 100),
      10,
    );
  });

  it('rechnet die Zuschläge auf der richtigen Basis', () => {
    const pos = Object.fromEntries(calc.positionen.map((p) => [p.schluessel, p]));
    expect(pos.mgk.betrag).toBeCloseTo(
      calc.materialeinzelkosten * (profil.materialGemeinkostenProzent / 100),
      10,
    );
    expect(pos.verwaltung.betrag).toBeCloseTo(
      calc.herstellkosten * (profil.verwaltungProzent / 100),
      10,
    );
    expect(pos.vertrieb.basis).toBeCloseTo(calc.herstellkosten, 10);
  });

  it('hinterlegt zu jeder Position eine Herleitung', () => {
    for (const p of calc.positionen) {
      expect(p.herleitung.length).toBeGreaterThan(5);
      expect(p.label.length).toBeGreaterThan(2);
    }
  });

  it('liefert eine Bandbreite, die den Punktwert einschließt', () => {
    expect(calc.vollkostenMin).toBeLessThanOrEqual(calc.vollkosten);
    expect(calc.vollkostenMax).toBeGreaterThanOrEqual(calc.vollkosten);
  });

  it('liefert eine Konfidenz zwischen 0 und 1', () => {
    expect(calc.konfidenz).toBeGreaterThan(0);
    expect(calc.konfidenz).toBeLessThanOrEqual(1);
  });

  it('ergibt plausible Größenordnungen für ein 500-g-Müsli', () => {
    // Rohware eines Standardmüslis liegt bei rund 0,50–1,50 € je 500 g.
    expect(calc.rohwarenkosten).toBeGreaterThan(0.3);
    expect(calc.rohwarenkosten).toBeLessThan(2.5);
    expect(calc.vollkosten).toBeGreaterThan(calc.herstellkosten);
    expect(calc.abgabepreis).toBeGreaterThan(calc.vollkosten);
  });
});

describe('Rohwarenkosten', () => {
  it('berücksichtigt den Produktionsverlust über den Einsatzfaktor', () => {
    const ohne = testprodukt();
    ohne.recipe = { ...ohne.recipe, verlustQuote: 0 };
    const mit = testprodukt();
    mit.recipe = { ...mit.recipe, verlustQuote: 0.1 };

    const a = rechne(ohne);
    const b = rechne(mit);
    expect(b.rohwarenkosten).toBeGreaterThan(a.rohwarenkosten);
    expect(b.einsatzmengeG).toBeCloseTo(500 / 0.9, 6);
    expect(a.einsatzmengeG).toBeCloseTo(500, 6);
  });

  it('skaliert linear mit der Füllmenge', () => {
    const klein = testprodukt();
    const gross = testprodukt({ fuellmengeG: geschaetzt(1000, 0.95, 'nutzer') });
    const a = rechne(klein);
    const b = rechne(gross);
    expect(b.rohwarenkosten).toBeCloseTo(a.rohwarenkosten * 2, 6);
  });

  it('sortiert die Kostentreiber absteigend', () => {
    const calc = rechne(testprodukt());
    const top = topKostentreiber(calc);
    expect(top.length).toBeGreaterThan(0);
    for (let i = 1; i < top.length; i++) {
      expect(top[i].kostenJeVe).toBeLessThanOrEqual(top[i - 1].kostenJeVe);
    }
    expect(top.reduce((s, z) => s + z.anteilAnRohware, 0)).toBeLessThanOrEqual(1.0001);
  });

  it('verteuert Bio-Qualität gegenüber Standard', () => {
    const standard = testprodukt();
    const bio = testprodukt();
    bio.recipe = {
      ...bio.recipe,
      lines: bio.recipe.lines.map((l) => ({ ...l, qualitaet: 'bio' as const })),
    };
    expect(rechne(bio).rohwarenkosten).toBeGreaterThan(rechne(standard).rohwarenkosten);
  });

  it('macht die Mengenstaffel wirksam', () => {
    const klein = testprodukt({ staffel: 'kleinmenge' });
    const gross = testprodukt({ staffel: 'grosskontrakt' });
    expect(rechne(klein).rohwarenkosten).toBeGreaterThan(rechne(gross).rohwarenkosten);
  });
});

describe('Verpackungskalkulation', () => {
  it('schätzt drei Ebenen und rechnet sie auf die VE herunter', () => {
    const specs = schaetzeVerpackung('faltschachtel', 500, ['Sichtfenster']);
    const s = summiereVerpackung(specs);
    expect(specs.some((x) => x.ebene === 'primaer')).toBe(true);
    expect(specs.some((x) => x.ebene === 'sekundaer')).toBe(true);
    expect(specs.some((x) => x.ebene === 'tertiaer')).toBe(true);
    expect(s.gesamt).toBeCloseTo(s.primaer + s.sekundaer + s.tertiaer, 10);
    expect(s.primaer).toBeGreaterThan(s.tertiaer);
  });

  it('verteilt Sekundär- und Tertiärverpackung auf die Gebindegröße', () => {
    const umkarton = schaetzeVerpackung('faltschachtel', 500).find((s) => s.ebene === 'sekundaer')!;
    const einzeln = kostenJeVe({ ...umkarton, vePro: 1 });
    expect(kostenJeVe(umkarton)).toBeCloseTo(einzeln / umkarton.vePro, 10);
  });

  it('rechnet das Lizenzentgelt nur auf die Verkaufsverpackung', () => {
    const s = summiereVerpackung(schaetzeVerpackung('folienbeutel', 250));
    expect(s.lizenz).toBeGreaterThan(0);
    expect(s.lizenz).toBeLessThan(s.gesamt);
  });

  it('macht Zusatzmerkmale teurer', () => {
    const ohne = summiereVerpackung(schaetzeVerpackung('standbodenbeutel', 400)).gesamt;
    const mit = summiereVerpackung(
      schaetzeVerpackung('standbodenbeutel', 400, ['Zip-Verschluss', 'Aromaschutzventil']),
    ).gesamt;
    expect(mit).toBeGreaterThan(ohne);
  });

  it('macht ein Glas teurer als einen Folienbeutel gleicher Füllmenge', () => {
    const glas = summiereVerpackung(schaetzeVerpackung('glas', 400)).gesamt;
    const beutel = summiereVerpackung(schaetzeVerpackung('folienbeutel', 400)).gesamt;
    expect(glas).toBeGreaterThan(beutel);
  });
});

describe('Losgrößenlogik', () => {
  it('senkt die Stückkosten mit steigender Jahresmenge', () => {
    const stufen = berechneLosgroessen({ product: testprodukt(), profile: profil, preise });
    expect(stufen).toHaveLength(3);
    for (let i = 1; i < stufen.length; i++) {
      expect(stufen[i].vollkosten).toBeLessThan(stufen[i - 1].vollkosten);
    }
  });

  it('wirkt nur über die Rüstkostendegression, nicht auf die Rohware', () => {
    const p = testprodukt();
    const klein = berechneKalkulation({ product: p, profile: { ...profil, losgroesseVe: 5000 }, preise });
    const gross = berechneKalkulation({ product: p, profile: { ...profil, losgroesseVe: 500000 }, preise });
    expect(klein.rohwarenkosten).toBeCloseTo(gross.rohwarenkosten, 10);
    expect(klein.herstellkosten).toBeGreaterThan(gross.herstellkosten);
  });
});

describe('Handelsstufe', () => {
  const p = { ...profil, handelsspanneProzent: 30, mehrwertsteuerProzent: 7 };

  it('rechnet vom Abgabepreis bis zum Verbraucherpreis durch', () => {
    const h = berechneHandel(2, p);
    const konditionenSatz =
      (p.grundrabattProzent + p.zentralregulierungProzent + p.wkzProzent + p.bonusProzent) / 100;
    expect(h.konditionen).toBeCloseTo(2 * konditionenSatz, 10);
    expect(h.nettoNettoEk).toBeCloseTo(2 - h.konditionen, 10);
    expect(h.vkNetto).toBeCloseTo(h.nettoNettoEk / 0.7, 10);
    expect(h.vkBrutto).toBeCloseTo(h.vkNetto * 1.07, 10);
  });

  it('ist zur Rückwärtsrechnung invers', () => {
    const h = berechneHandel(2.4, p);
    const r = berechneRueckwaerts(h.vkBrutto, p, 2, 1.8, 2.2);
    expect(r.impliziterBlp).toBeCloseTo(2.4, 8);
    expect(r.vkNetto).toBeCloseTo(h.vkNetto, 8);
    expect(r.nettoNettoEk).toBeCloseTo(h.nettoNettoEk, 8);
  });

  it('leitet aus dem Regalpreis eine Marge mit Bandbreite ab', () => {
    const calc = rechne(testprodukt({ regalpreis: geschaetzt(3.49, 0.9, 'foto') }));
    expect(calc.rueckwaerts).not.toBeNull();
    const r = calc.rueckwaerts!;
    expect(r.margeAbsolut).toBeCloseTo(r.impliziterBlp - calc.vollkosten, 10);
    expect(r.margeMinProzent).toBeLessThanOrEqual(r.margeProzent);
    expect(r.margeMaxProzent).toBeGreaterThanOrEqual(r.margeProzent);
  });

  it('lässt die Rückwärtsrechnung ohne Regalpreis weg', () => {
    expect(rechne(testprodukt()).rueckwaerts).toBeNull();
  });
});

describe('Simulation und Sensitivität', () => {
  const eingabe = { product: testprodukt(), profile: profil, preise };

  it('reagiert auf den Rohstoffpreishebel', () => {
    const basis = berechneKalkulation({ ...eingabe, hebel: NEUTRALE_HEBEL });
    const teuer = berechneKalkulation({
      ...eingabe,
      hebel: { ...NEUTRALE_HEBEL, rohstoffpreisFaktor: 1.2 },
    });
    expect(teuer.rohwarenkosten).toBeCloseTo(basis.rohwarenkosten * 1.2, 8);
    expect(teuer.vollkosten).toBeGreaterThan(basis.vollkosten);
  });

  it('sortiert das Tornado-Diagramm nach Hebelwirkung', () => {
    const t = berechneTornado(eingabe);
    expect(t.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].spanne).toBeLessThanOrEqual(t[i - 1].spanne);
    }
    expect(t[0].spanne).toBeGreaterThan(0);
  });

  it('rechnet den Stresstest +20 % Rohstoffpreis', () => {
    const s = stresstest(eingabe);
    expect(s.deltaAbsolut).toBeGreaterThan(0);
    expect(s.deltaProzent).toBeGreaterThan(0);
    expect(s.vollkostenStress).toBeCloseTo(s.vollkostenBasis + s.deltaAbsolut, 10);
  });

  it('ordnet Best/Base/Worst richtig an', () => {
    const werte = SZENARIO_VORLAGEN.map(
      (v) => berechneKalkulation({ ...eingabe, hebel: v.hebel }).vollkosten,
    );
    expect(werte[0]).toBeLessThan(werte[1]);
    expect(werte[2]).toBeGreaterThan(werte[1]);
  });

  it('lässt den Gewinnzuschlag über den Hebel überschreiben', () => {
    const p = wendeHebelAn(profil, { ...NEUTRALE_HEBEL, gewinnzuschlagProzent: 15 });
    expect(p.gewinnzuschlagProzent).toBe(15);
    const q = wendeHebelAn(profil, NEUTRALE_HEBEL);
    expect(q.gewinnzuschlagProzent).toBe(profil.gewinnzuschlagProzent);
  });
});

describe('Robustheit', () => {
  it('kommt ohne Zutatenliste zurecht', () => {
    const p = testprodukt({ zutatenText: geschaetzt('', 0, 'nutzer') });
    const calc = rechne(rechneProduktNeu(p));
    expect(calc.rohwarenkosten).toBe(0);
    expect(calc.vollkosten).toBeGreaterThan(0);
    expect(Number.isFinite(calc.abgabepreis)).toBe(true);
  });

  it('kommt mit Füllmenge 0 zurecht', () => {
    const calc = rechne(testprodukt({ fuellmengeG: geschaetzt(0, 0.5, 'nutzer') }));
    expect(calc.rohwarenkosten).toBe(0);
    expect(Number.isFinite(calc.vollkosten)).toBe(true);
  });

  it('erzeugt keine NaN-Werte bei extremen Profilwerten', () => {
    const extrem: CostingProfile = {
      ...profil,
      ausbringungJeStunde: 0,
      losgroesseVe: 0,
      vePalette: 0,
      handelsspanneProzent: 0,
    };
    const calc = rechne(testprodukt(), extrem);
    for (const pos of calc.positionen) expect(Number.isFinite(pos.betrag)).toBe(true);
    expect(Number.isFinite(calc.vollkosten)).toBe(true);
    expect(Number.isFinite(calc.handel!.vkBrutto)).toBe(true);
  });
});
