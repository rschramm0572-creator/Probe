import { geschaetzt, neuesProdukt, rechneProduktNeu, profilId, schaetzeVerpackung } from '../costing';
import type { Naehrwerte, Product } from '../costing';

/**
 * Demodaten.
 *
 * Damit die Methodik ohne API-Schluessel nachvollziehbar ist: zwei reale
 * Warengruppenvertreter – Markenartikel und Handelsmarke – mit Etikettenangaben,
 * wie sie am Regal abgelesen werden. Die Fotos fehlen bewusst; alles Weitere
 * durchlaeuft dieselbe Rechenkette wie eine echte Erfassung.
 */

interface DemoVorlage {
  name: string;
  marke: string;
  hersteller: string;
  haendler: string;
  kategorie: string;
  fuellmengeG: number;
  zutaten: string;
  naehrwerte: Naehrwerte;
  verpackung: Parameters<typeof schaetzeVerpackung>[0];
  merkmale: string[];
  siegel: string[];
  regalpreis: number;
  ean: string;
}

const VORLAGEN: DemoVorlage[] = [
  {
    name: 'Knuspermüsli Schoko',
    marke: 'Markenartikel',
    hersteller: 'Beispiel Cerealien GmbH, 33602 Bielefeld',
    haendler: 'Vollsortimenter',
    kategorie: 'muesli',
    fuellmengeG: 500,
    zutaten:
      'Vollkorn-Haferflocken 58 %, Zucker, Sonnenblumenöl, Schokoladenstückchen 6 % (Zucker, Kakaomasse, Kakaobutter, Emulgator Lecithine), Glukosesirup, Kakaopulver stark entölt 2 %, Haselnüsse 2 %, Gerstenmalzextrakt, Salz, natürliches Aroma',
    naehrwerte: {
      energieKj: 1889,
      fett: 15.2,
      gesaettigt: 3.1,
      kohlenhydrate: 60.4,
      zucker: 19.8,
      ballaststoffe: 6.8,
      eiweiss: 8.4,
      salz: 0.28,
    },
    verpackung: 'faltschachtel',
    merkmale: ['Innenbeutel', 'Recycling-Hinweis'],
    siegel: ['Nutri-Score C'],
    regalpreis: 3.29,
    ean: '4000000000017',
  },
  {
    name: 'Knuspermüsli Schoko',
    marke: 'Handelsmarke',
    hersteller: 'Abgepackt für den Handel, 48155 Münster',
    haendler: 'Vollsortimenter',
    kategorie: 'muesli',
    fuellmengeG: 750,
    zutaten:
      'Haferflocken, Zucker, Pflanzenöl (Palm), Schokoladenstückchen 4 % (Zucker, Kakaomasse, Kakaobutter, Emulgator Lecithine), Glukosesirup, Kakaopulver stark entölt, Salz, Aroma',
    naehrwerte: {
      energieKj: 1902,
      fett: 15.8,
      gesaettigt: 5.4,
      kohlenhydrate: 61.2,
      zucker: 21.5,
      ballaststoffe: 6.1,
      eiweiss: 7.9,
      salz: 0.31,
    },
    verpackung: 'folienbeutel',
    merkmale: ['Zip-Verschluss'],
    siegel: ['Nutri-Score C'],
    regalpreis: 2.19,
    ean: '4000000000024',
  },
];

export function erzeugeDemoProdukte(): Product[] {
  return VORLAGEN.map((v) => {
    const p = neuesProdukt();
    const basis: Product = {
      ...p,
      name: geschaetzt(v.name, 0.92, 'foto'),
      marke: geschaetzt(v.marke, 0.9, 'foto'),
      hersteller: geschaetzt(v.hersteller, 0.74, 'foto'),
      herkunftsland: geschaetzt('Deutschland', 0.66, 'foto'),
      kategorie: geschaetzt(v.kategorie, 0.88, 'foto'),
      haendler: v.haendler,
      fuellmengeG: geschaetzt(v.fuellmengeG, 0.95, 'foto'),
      ean: geschaetzt(v.ean, 0.71, 'foto'),
      zutatenText: geschaetzt(v.zutaten, 0.86, 'foto'),
      naehrwerte: geschaetzt(v.naehrwerte, 0.9, 'foto'),
      verpackungsart: geschaetzt(v.verpackung, 0.82, 'foto'),
      verpackungsMerkmale: v.merkmale,
      siegel: v.siegel.map((s) => ({ name: s, konfidenz: 0.8 })),
      regalpreis: geschaetzt(v.regalpreis, 0.85, 'foto'),
      packaging: schaetzeVerpackung(v.verpackung, v.fuellmengeG, v.merkmale),
      profileId: profilId(v.kategorie),
      analyseStatus: 'fertig',
      notiz: 'Demodatensatz – ohne Foto erfasst.',
    };
    return rechneProduktNeu(basis);
  });
}
