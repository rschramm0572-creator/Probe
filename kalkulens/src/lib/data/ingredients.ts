import type { Ingredient, IngredientGruppe, Naehrwerte } from '../costing/types';

/**
 * Rohstoff-Stammdaten.
 *
 * Die Naehrwerte je 100 g stammen aus oeffentlichen Naehrwerttabellen und sind
 * bewusst als runde Durchschnittswerte gepflegt – sie dienen der Ruecklaeufigen
 * Rezepturschaetzung, nicht der Deklaration. Der Basispreis ist ein
 * Industrie-Einkaufspreis je kg (Kontraktstaffel) und wird in der App gepflegt.
 */
export interface IngredientSeed extends Ingredient {
  /** Einkaufspreis je kg in EUR, Qualitaet Standard, Staffel "Kontrakt". */
  basispreisJeKg: number;
  /** Aufschlagsfaktor fuer Bio-Qualitaet. */
  bioFaktor: number;
}

type Row = [
  id: string,
  name: string,
  gruppe: IngredientGruppe,
  nw: [number, number, number, number, number, number, number, number],
  preis: number,
  bioFaktor: number,
  minAnteil: number,
  maxAnteil: number,
  synonyme: string,
];

// nw = [energieKj, fett, gesaettigt, kohlenhydrate, zucker, ballaststoffe, eiweiss, salz]
const ROWS: Row[] = [
  // --- Getreide & Mahlerzeugnisse -----------------------------------------
  ['weizenmehl', 'Weizenmehl Type 405', 'getreide', [1450, 1.0, 0.2, 71, 1.0, 3.5, 10, 0.01], 0.55, 1.9, 0, 100, 'weizenmehl|weizenmehl type 405|weizenmehl type 550|mehl|weizenauszugsmehl'],
  ['weizenvollkornmehl', 'Weizenvollkornmehl', 'getreide', [1400, 2.0, 0.4, 61, 1.5, 11, 12, 0.01], 0.62, 1.9, 0, 100, 'weizenvollkornmehl|vollkornweizenmehl|weizenvollkorn'],
  ['dinkelmehl', 'Dinkelmehl', 'getreide', [1440, 1.4, 0.2, 69, 1.0, 4.0, 11, 0.01], 0.95, 1.7, 0, 100, 'dinkelmehl|dinkelvollkornmehl|dinkel'],
  ['roggenmehl', 'Roggenmehl', 'getreide', [1370, 1.7, 0.2, 66, 1.0, 7.0, 8.5, 0.01], 0.52, 1.9, 0, 100, 'roggenmehl|roggenvollkornmehl|roggen'],
  ['hafer', 'Haferflocken', 'getreide', [1560, 7.0, 1.3, 59, 1.0, 10, 13.5, 0.02], 0.78, 1.8, 0, 100, 'haferflocken|hafer|hafervollkornflocken|haferkleie|hafervollkornmehl'],
  ['hartweizengriess', 'Hartweizengrieß', 'getreide', [1500, 1.4, 0.2, 71, 3.0, 3.5, 12.5, 0.01], 0.72, 1.7, 0, 100, 'hartweizengrieß|hartweizengriess|hartweizenmehl|durum'],
  ['maisgriess', 'Maisgrieß', 'getreide', [1520, 1.2, 0.2, 76, 0.7, 3.0, 8.0, 0.01], 0.68, 1.8, 0, 100, 'maisgrieß|maisgriess|maismehl|polenta|mais'],
  ['reis', 'Reis', 'getreide', [1500, 0.9, 0.2, 78, 0.2, 1.4, 7.0, 0.01], 0.95, 1.8, 0, 100, 'reis|reismehl|reisgrieß|parboiled reis'],
  ['gerste', 'Gerstenflocken', 'getreide', [1490, 2.3, 0.5, 64, 1.0, 9.0, 10, 0.01], 0.70, 1.8, 0, 60, 'gerste|gerstenflocken|gerstenmehl'],
  ['weizenkleie', 'Weizenkleie', 'getreide', [1000, 4.3, 0.6, 22, 0.4, 43, 15.5, 0.01], 0.42, 1.9, 0, 30, 'weizenkleie|kleie|haferkleie'],
  ['malzextrakt', 'Gerstenmalzextrakt', 'getreide', [1300, 0.5, 0.1, 75, 60, 1.0, 5.0, 0.10], 1.65, 1.7, 0, 15, 'gerstenmalzextrakt|malzextrakt|gerstenmalz|malz'],

  // --- Zucker & Suessungsmittel -------------------------------------------
  ['zucker', 'Zucker', 'zucker', [1700, 0, 0, 100, 100, 0, 0, 0], 0.85, 1.8, 0, 100, 'zucker|saccharose|rohrzucker|rohrohrzucker|kristallzucker|rübenzucker|brauner zucker'],
  ['glukosesirup', 'Glukosesirup', 'zucker', [1345, 0, 0, 80, 35, 0, 0, 0.05], 0.78, 1.9, 0, 80, 'glukosesirup|glucosesirup|glukose-fruktose-sirup|glucose-fructose-sirup|stärkesirup'],
  ['dextrose', 'Dextrose', 'zucker', [1600, 0, 0, 95, 95, 0, 0, 0], 1.05, 1.8, 0, 60, 'dextrose|traubenzucker|glukose|glucose'],
  ['invertzucker', 'Invertzuckersirup', 'zucker', [1290, 0, 0, 76, 76, 0, 0, 0.02], 0.95, 1.8, 0, 60, 'invertzuckersirup|invertzucker|zuckersirup'],
  ['honig', 'Honig', 'zucker', [1370, 0, 0, 80, 80, 0.2, 0.4, 0.01], 3.20, 1.7, 0, 40, 'honig|blütenhonig|akazienhonig'],
  ['karamellsirup', 'Karamellsirup', 'zucker', [1300, 0, 0, 76, 60, 0, 0.5, 0.10], 1.40, 1.6, 0, 30, 'karamellsirup|karamell|karamellzucker'],

  // --- Fette & Oele --------------------------------------------------------
  ['rapsoel', 'Rapsöl', 'fett', [3700, 100, 7, 0, 0, 0, 0, 0], 1.35, 1.9, 0, 100, 'rapsöl|rapsoel|raps'],
  ['sonnenblumenoel', 'Sonnenblumenöl', 'fett', [3700, 100, 11, 0, 0, 0, 0, 0], 1.30, 1.9, 0, 100, 'sonnenblumenöl|sonnenblumenoel'],
  ['palmoel', 'Palmöl / Palmfett', 'fett', [3700, 100, 49, 0, 0, 0, 0, 0], 1.15, 1.8, 0, 100, 'palmöl|palmfett|palmoel|pflanzenfett|palmkernfett|pflanzliches fett'],
  ['pflanzenoel', 'Pflanzenöl (unspezifiziert)', 'fett', [3700, 100, 20, 0, 0, 0, 0, 0], 1.25, 1.9, 0, 100, 'pflanzenöl|pflanzliches öl|pflanzenoel|speiseöl'],
  ['kokosfett', 'Kokosfett', 'fett', [3700, 100, 87, 0, 0, 0, 0, 0], 1.85, 1.8, 0, 100, 'kokosfett|kokosöl|kokosoel'],
  ['butter', 'Butter', 'fett', [3050, 82, 52, 0.6, 0.6, 0, 0.7, 1.2], 6.20, 1.5, 0, 60, 'butter|süßrahmbutter|sauerrahmbutter'],
  ['butterreinfett', 'Butterreinfett', 'fett', [3700, 99.8, 65, 0, 0, 0, 0, 0], 7.40, 1.5, 0, 40, 'butterreinfett|butterschmalz|milchfett|butterfett'],
  ['margarine', 'Margarine', 'fett', [2600, 70, 20, 0.4, 0.4, 0, 0.2, 0.8], 1.95, 1.7, 0, 60, 'margarine|pflanzenmargarine'],
  ['olivenoel', 'Olivenöl', 'fett', [3700, 100, 14, 0, 0, 0, 0, 0], 6.80, 1.5, 0, 60, 'olivenöl|olivenoel|natives olivenöl'],

  // --- Milcherzeugnisse ----------------------------------------------------
  ['magermilchpulver', 'Magermilchpulver', 'milch', [1500, 1.0, 0.6, 52, 52, 0, 35, 1.2], 2.60, 1.6, 0, 60, 'magermilchpulver|entrahmtes milchpulver|magermilchkonzentrat'],
  ['vollmilchpulver', 'Vollmilchpulver', 'milch', [2100, 26, 17, 38, 38, 0, 25, 0.9], 3.60, 1.6, 0, 60, 'vollmilchpulver|milchpulver|trockenvollmilch'],
  ['molkenpulver', 'Süßmolkenpulver', 'milch', [1550, 1.0, 0.6, 75, 70, 0, 12, 1.8], 1.10, 1.7, 0, 50, 'molkenpulver|süßmolkenpulver|molkenerzeugnis|molke'],
  ['sahnepulver', 'Sahnepulver', 'milch', [2800, 50, 33, 30, 30, 0, 15, 0.7], 5.20, 1.5, 0, 40, 'sahnepulver|rahmpulver'],
  ['milch', 'Milch (3,5 % Fett)', 'milch', [280, 3.5, 2.3, 4.8, 4.8, 0, 3.4, 0.10], 0.62, 1.6, 0, 90, 'milch|vollmilch|frischmilch'],
  ['joghurt', 'Joghurt', 'milch', [270, 3.5, 2.2, 4.5, 4.5, 0, 3.3, 0.13], 0.95, 1.6, 0, 90, 'joghurt|jogurt|naturjoghurt'],
  ['kaese', 'Käse (Schnittkäse)', 'milch', [1500, 27, 18, 0.5, 0.5, 0, 25, 2.0], 4.80, 1.5, 0, 60, 'käse|gouda|edamer|schnittkäse|mozzarella|hartkäse'],
  ['sauerrahm', 'Schmand / Sauerrahm', 'milch', [850, 20, 13, 3.5, 3.5, 0, 2.8, 0.10], 1.90, 1.6, 0, 70, 'schmand|sauerrahm|crème fraîche|saure sahne'],

  // --- Ei ------------------------------------------------------------------
  ['volleipulver', 'Volleipulver', 'ei', [2400, 42, 12, 2.0, 2.0, 0, 47, 1.0], 8.50, 1.5, 0, 30, 'volleipulver|eipulver|trockenei'],
  ['eiklarpulver', 'Eiklarpulver', 'ei', [1550, 0.3, 0.1, 5, 5, 0, 82, 1.5], 12.50, 1.4, 0, 20, 'eiklarpulver|eiweißpulver|eialbumin'],
  ['ei', 'Hühnerei (Vollei, flüssig)', 'ei', [590, 10, 3.0, 0.7, 0.7, 0, 12.5, 0.35], 2.60, 1.7, 0, 60, 'ei|eier|hühnerei|vollei|freilandei'],

  // --- Nuesse & Saaten -----------------------------------------------------
  ['haselnuss', 'Haselnüsse', 'nuss', [2700, 62, 4.5, 7, 4.5, 8, 14, 0.01], 8.50, 1.5, 0, 60, 'haselnüsse|haselnuss|haselnusskerne|haselnussmark'],
  ['mandel', 'Mandeln', 'nuss', [2500, 54, 4.2, 5, 4.5, 12, 21, 0.01], 8.20, 1.5, 0, 60, 'mandeln|mandel|mandelkerne|mandelmehl|mandelmark'],
  ['walnuss', 'Walnüsse', 'nuss', [2800, 65, 6.1, 7, 2.6, 6.7, 15, 0.01], 9.50, 1.5, 0, 40, 'walnüsse|walnuss|walnusskerne'],
  ['cashew', 'Cashewkerne', 'nuss', [2400, 44, 8, 27, 6, 3, 18, 0.02], 7.80, 1.5, 0, 50, 'cashew|cashewkerne|cashewnüsse'],
  ['erdnuss', 'Erdnüsse', 'nuss', [2450, 49, 8.5, 8, 4.5, 8.5, 26, 0.02], 2.60, 1.6, 0, 60, 'erdnüsse|erdnuss|erdnusskerne|erdnussmus'],
  ['sonnenblumenkerne', 'Sonnenblumenkerne', 'nuss', [2500, 51, 4.5, 11, 2.6, 6, 21, 0.01], 1.75, 1.7, 0, 40, 'sonnenblumenkerne|sonnenblumensamen'],
  ['kuerbiskerne', 'Kürbiskerne', 'nuss', [2400, 46, 8, 12, 1.4, 6, 25, 0.02], 5.40, 1.6, 0, 30, 'kürbiskerne|kuerbiskerne'],
  ['leinsamen', 'Leinsamen', 'nuss', [2230, 42, 3.7, 1.6, 1.6, 27, 18, 0.03], 1.55, 1.7, 0, 25, 'leinsamen|leinsaat|leinsamenschrot'],
  ['sesam', 'Sesam', 'nuss', [2500, 50, 7, 10, 0.3, 11, 18, 0.02], 2.90, 1.6, 0, 30, 'sesam|sesamsamen|sesamsaat'],
  ['kokosraspel', 'Kokosraspel', 'nuss', [2700, 62, 55, 7, 7, 16, 6, 0.04], 2.40, 1.6, 0, 40, 'kokosraspel|kokosflocken|kokosnussraspel|kokos'],

  // --- Fruechte ------------------------------------------------------------
  ['rosinen', 'Rosinen / Sultaninen', 'frucht', [1250, 0.5, 0.1, 68, 63, 4, 2.5, 0.03], 2.10, 1.6, 0, 50, 'rosinen|sultaninen|weinbeeren|korinthen'],
  ['datteln', 'Datteln', 'frucht', [1180, 0.4, 0, 65, 60, 8, 2.5, 0.01], 3.30, 1.6, 0, 60, 'datteln|dattelpaste|dattel'],
  ['aprikose_getrocknet', 'Aprikosen, getrocknet', 'frucht', [1000, 0.5, 0, 51, 47, 10, 3.4, 0.02], 3.90, 1.6, 0, 40, 'aprikosen|aprikose|getrocknete aprikosen'],
  ['cranberry', 'Cranberries, getrocknet', 'frucht', [1400, 1.0, 0.1, 78, 70, 5, 0.2, 0.02], 5.20, 1.5, 0, 30, 'cranberries|cranberry|preiselbeeren'],
  ['apfel_getrocknet', 'Apfelstücke, getrocknet', 'frucht', [1200, 0.5, 0.1, 65, 55, 12, 1.0, 0.02], 4.60, 1.6, 0, 30, 'apfelstücke|getrocknete äpfel|apfelwürfel'],
  ['erdbeere', 'Erdbeeren (TK)', 'frucht', [140, 0.4, 0, 5.5, 5.0, 2.0, 0.8, 0.01], 2.20, 1.6, 0, 60, 'erdbeeren|erdbeere|erdbeerpüree'],
  ['apfelmark', 'Apfelmark', 'frucht', [250, 0.2, 0, 13, 12, 1.5, 0.3, 0.01], 1.10, 1.6, 0, 70, 'apfelmark|apfelmus|apfelpüree'],
  ['tomatenmark', 'Tomatenmark', 'gemuese', [350, 0.5, 0.1, 13, 10, 3.0, 4.5, 0.20], 1.35, 1.6, 0, 60, 'tomatenmark|tomatenpüree|tomatenkonzentrat|passierte tomaten|tomaten'],
  ['fruchtsaftkonzentrat', 'Fruchtsaftkonzentrat', 'frucht', [800, 0.2, 0, 45, 42, 1.0, 1.5, 0.02], 2.30, 1.6, 0, 40, 'fruchtsaftkonzentrat|apfelsaftkonzentrat|orangensaftkonzentrat|saftkonzentrat'],

  // --- Gemuese -------------------------------------------------------------
  ['kartoffel', 'Kartoffeln', 'gemuese', [300, 0.1, 0, 15, 0.8, 2.0, 2.0, 0.01], 0.55, 1.8, 0, 90, 'kartoffeln|kartoffel|kartoffelflocken|kartoffelwürfel'],
  ['zwiebel', 'Zwiebeln', 'gemuese', [150, 0.2, 0, 7, 5, 1.8, 1.2, 0.01], 0.65, 1.7, 0, 40, 'zwiebeln|zwiebel|röstzwiebeln|zwiebelpulver'],
  ['karotte', 'Karotten', 'gemuese', [150, 0.2, 0, 7, 5, 3.0, 0.9, 0.06], 0.60, 1.7, 0, 50, 'karotten|möhren|karotte|möhre'],
  ['erbsen', 'Erbsen (TK)', 'gemuese', [340, 0.5, 0.1, 12, 4, 5.0, 5.5, 0.01], 1.10, 1.7, 0, 50, 'erbsen|erbse|grüne erbsen'],
  ['mais_gemuese', 'Zuckermais', 'gemuese', [380, 1.2, 0.2, 16, 6, 3.0, 3.2, 0.02], 1.20, 1.6, 0, 50, 'zuckermais|maiskörner'],
  ['paprika', 'Paprika', 'gemuese', [130, 0.3, 0, 5, 4, 2.0, 1.0, 0.01], 1.60, 1.6, 0, 40, 'paprika|paprikaschoten|paprikastücke'],
  ['champignon', 'Champignons', 'gemuese', [100, 0.3, 0, 0.6, 0.6, 2.0, 2.7, 0.02], 2.20, 1.6, 0, 40, 'champignons|pilze|champignon'],

  // --- Fleisch & Fisch -----------------------------------------------------
  ['schwein', 'Schweinefleisch', 'fleisch', [700, 12, 4.5, 0, 0, 0, 20, 0.12], 3.80, 1.7, 0, 70, 'schweinefleisch|schwein|schweinehackfleisch'],
  ['haehnchen', 'Hähnchenbrust', 'fleisch', [460, 1.5, 0.5, 0, 0, 0, 23, 0.10], 4.60, 1.8, 0, 70, 'hähnchenfleisch|hähnchenbrust|hühnerfleisch|geflügelfleisch|putenfleisch'],
  ['rind', 'Rindfleisch', 'fleisch', [600, 8, 3.4, 0, 0, 0, 21, 0.15], 6.90, 1.7, 0, 70, 'rindfleisch|rind|rinderhackfleisch'],
  ['salami', 'Salami', 'fleisch', [1700, 35, 14, 1, 1, 0, 22, 4.2], 6.40, 1.6, 0, 40, 'salami|wurst|schinken|speck'],
  ['thunfisch', 'Thunfisch', 'fleisch', [480, 1.0, 0.3, 0, 0, 0, 24, 0.30], 6.20, 1.4, 0, 70, 'thunfisch|thunfischfilet'],
  ['lachs', 'Lachs', 'fleisch', [900, 15, 3.0, 0, 0, 0, 20, 0.10], 11.50, 1.4, 0, 70, 'lachs|lachsfilet|räucherlachs'],

  // --- Kakao & Schokolade --------------------------------------------------
  ['kakaomasse', 'Kakaomasse', 'kakao', [2400, 52, 31, 12, 1.0, 17, 13, 0.02], 6.90, 1.5, 0, 60, 'kakaomasse|kakao|kakaobohnen'],
  ['kakaobutter', 'Kakaobutter', 'kakao', [3700, 100, 60, 0, 0, 0, 0, 0], 9.80, 1.4, 0, 40, 'kakaobutter'],
  ['kakaopulver', 'Kakaopulver, stark entölt', 'kakao', [1300, 11, 6.5, 9, 0.8, 30, 21, 0.06], 4.40, 1.5, 0, 40, 'kakaopulver|magerer kakao|entölter kakao|kakaopulver stark entölt'],
  ['vollmilchschokolade', 'Vollmilchschokolade', 'kakao', [2250, 33, 20, 55, 52, 3.0, 7.0, 0.15], 5.60, 1.5, 0, 60, 'vollmilchschokolade|milchschokolade|schokolade|schokoladenglasur|schokoladendrops'],
  ['zartbitterschokolade', 'Zartbitterschokolade', 'kakao', [2350, 38, 23, 40, 32, 9.0, 8.0, 0.02], 6.30, 1.5, 0, 60, 'zartbitterschokolade|dunkle schokolade|halbbitterschokolade|edelbitterschokolade'],

  // --- Staerke & Bindemittel -----------------------------------------------
  ['maisstaerke', 'Maisstärke', 'staerke', [1550, 0.3, 0.1, 87, 0, 0.9, 0.3, 0.01], 0.95, 1.8, 0, 60, 'maisstärke|maisstaerke|speisestärke'],
  ['weizenstaerke', 'Weizenstärke', 'staerke', [1500, 0.2, 0, 86, 0, 0.5, 0.3, 0.01], 0.88, 1.8, 0, 60, 'weizenstärke'],
  ['kartoffelstaerke', 'Kartoffelstärke', 'staerke', [1450, 0.1, 0, 85, 0, 0, 0.1, 0.01], 1.05, 1.8, 0, 60, 'kartoffelstärke'],
  ['modifizierte_staerke', 'Modifizierte Stärke', 'staerke', [1500, 0.2, 0, 86, 0, 0.5, 0.3, 0.02], 1.45, 1.7, 0, 30, 'modifizierte stärke|modifizierte maisstärke|stärke'],
  ['guarkernmehl', 'Guarkernmehl', 'staerke', [800, 0.5, 0.1, 10, 0, 75, 5, 0.05], 4.20, 1.6, 0, 3, 'guarkernmehl|guar'],
  ['johannisbrotkernmehl', 'Johannisbrotkernmehl', 'staerke', [800, 0.6, 0.1, 10, 0, 75, 5, 0.05], 9.50, 1.5, 0, 3, 'johannisbrotkernmehl|carubin'],
  ['pektin', 'Pektin', 'staerke', [700, 0, 0, 5, 0, 85, 1, 1.5], 16.00, 1.4, 0, 3, 'pektin|geliermittel pektin'],
  ['gelatine', 'Gelatine', 'staerke', [1450, 0.1, 0, 0, 0, 0, 85, 0.5], 9.20, 1.4, 0, 12, 'gelatine|schweinegelatine|rindergelatine'],
  ['xanthan', 'Xanthan', 'staerke', [600, 0, 0, 8, 0, 80, 4, 4.0], 11.50, 1.4, 0, 2, 'xanthan|xanthangummi'],

  // --- Proteine ------------------------------------------------------------
  ['sojaprotein', 'Sojaeiweiß', 'protein', [1600, 3, 0.5, 5, 0.5, 5, 85, 1.5], 3.40, 1.7, 0, 40, 'sojaeiweiß|sojaprotein|sojaproteinisolat|soja'],
  ['weizengluten', 'Weizengluten', 'protein', [1600, 6, 1, 14, 0, 2, 75, 0.10], 2.10, 1.7, 0, 30, 'weizengluten|weizenkleber|gluten'],
  ['erbsenprotein', 'Erbsenprotein', 'protein', [1550, 8, 1.5, 3, 0.5, 4, 80, 2.5], 4.80, 1.6, 0, 40, 'erbsenprotein|erbseneiweiß'],

  // --- Zusatz- & Hilfsstoffe ----------------------------------------------
  ['backtriebmittel', 'Backtriebmittel', 'zusatzstoff', [100, 0, 0, 25, 0, 0, 0, 28], 1.90, 1.3, 0, 4, 'backtriebmittel|backpulver|natriumhydrogencarbonat|natron|diphosphate|hirschhornsalz'],
  ['lecithin', 'Emulgator Lecithin', 'zusatzstoff', [3300, 90, 15, 5, 0, 0, 0, 0.10], 3.80, 1.6, 0, 3, 'lecithin|sojalecithin|sonnenblumenlecithin|emulgator lecithine'],
  ['mono_diglyceride', 'Emulgator Mono-/Diglyceride', 'zusatzstoff', [3400, 92, 40, 3, 0, 0, 0, 0.05], 4.20, 1.5, 0, 3, 'mono- und diglyceride|monoglyceride|emulgator|e471'],
  ['citronensaeure', 'Säureregulator Citronensäure', 'zusatzstoff', [1000, 0, 0, 60, 0, 0, 0, 0.05], 1.85, 1.5, 0, 3, 'citronensäure|zitronensäure|säuerungsmittel|säureregulator'],
  ['konservierung', 'Konservierungsstoff', 'zusatzstoff', [800, 0, 0, 45, 0, 0, 0, 0.10], 6.50, 1.4, 0, 1, 'konservierungsstoff|kaliumsorbat|natriumbenzoat|sorbinsäure'],
  ['ascorbinsaeure', 'Antioxidationsmittel Ascorbinsäure', 'zusatzstoff', [1000, 0, 0, 60, 0, 0, 0, 0], 9.50, 1.4, 0, 1, 'ascorbinsäure|antioxidationsmittel|vitamin c'],
  ['hefe', 'Hefe', 'zusatzstoff', [480, 1.5, 0.3, 10, 1.5, 6, 12, 0.05], 1.40, 1.6, 0, 8, 'hefe|backhefe|frischhefe'],
  ['trockenhefe', 'Trockenhefe', 'zusatzstoff', [1400, 6, 1, 40, 5, 22, 40, 0.20], 6.80, 1.5, 0, 3, 'trockenhefe|trockenbackhefe'],

  // --- Gewuerze & Aromen ---------------------------------------------------
  ['salz', 'Speisesalz', 'gewuerz', [0, 0, 0, 0, 0, 0, 0, 100], 0.28, 1.6, 0, 6, 'salz|speisesalz|kochsalz|jodsalz|meersalz'],
  ['aroma', 'Aroma', 'gewuerz', [800, 5, 1, 30, 10, 0, 0, 0.50], 22.00, 1.8, 0, 2, 'aroma|aromen|natürliches aroma|vanillearoma|natürliches vanillearoma'],
  ['vanille', 'Vanilleextrakt', 'gewuerz', [1000, 0.1, 0, 13, 13, 0, 0.1, 0.03], 48.00, 1.4, 0, 2, 'vanilleextrakt|vanille|bourbon-vanille|vanilleschote|vanillemark'],
  ['zimt', 'Zimt', 'gewuerz', [1000, 1.2, 0.3, 28, 2, 53, 4, 0.03], 6.50, 1.6, 0, 3, 'zimt|zimtpulver|ceylon-zimt'],
  ['pfeffer', 'Pfeffer', 'gewuerz', [1200, 3.3, 1, 39, 0.6, 26, 10, 0.05], 8.20, 1.6, 0, 2, 'pfeffer|schwarzer pfeffer|weißer pfeffer'],
  ['paprikapulver', 'Paprikapulver', 'gewuerz', [1300, 13, 2, 34, 10, 35, 14, 0.10], 5.60, 1.6, 0, 4, 'paprikapulver|paprikaextrakt|edelsüßes paprikapulver'],
  ['kraeuter', 'Kräuter, getrocknet', 'gewuerz', [1000, 5, 1, 25, 2, 40, 12, 0.10], 7.40, 1.6, 0, 4, 'kräuter|gewürze|oregano|basilikum|petersilie|thymian|gewürzmischung'],
  ['hefeextrakt', 'Hefeextrakt', 'gewuerz', [900, 0.5, 0.1, 12, 4, 3, 25, 20], 7.90, 1.5, 0, 4, 'hefeextrakt|geschmacksverstärker'],

  // --- Wasser & Sonstiges --------------------------------------------------
  ['wasser', 'Wasser', 'wasser', [0, 0, 0, 0, 0, 0, 0, 0], 0.004, 1.0, 0, 95, 'wasser|trinkwasser|quellwasser'],
  ['essig', 'Essig', 'sonstiges', [100, 0, 0, 0.4, 0.4, 0, 0, 0.01], 0.55, 1.7, 0, 30, 'essig|branntweinessig|weinessig|aceto'],
];

function nw(v: Row[3]): Naehrwerte {
  return {
    energieKj: v[0],
    fett: v[1],
    gesaettigt: v[2],
    kohlenhydrate: v[3],
    zucker: v[4],
    ballaststoffe: v[5],
    eiweiss: v[6],
    salz: v[7],
  };
}

export const INGREDIENTS: IngredientSeed[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  gruppe: r[2],
  naehrwerte: nw(r[3]),
  basispreisJeKg: r[4],
  bioFaktor: r[5],
  minAnteil: r[6],
  maxAnteil: r[7],
  synonyme: r[8].split('|'),
}));

export const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

/** Aufschlag der Mengenstaffel gegenueber dem Kontraktpreis. */
export const STAFFEL_FAKTOR = {
  kleinmenge: 1.35,
  kontrakt: 1.0,
  grosskontrakt: 0.88,
} as const;

/** Aufschlag fuer zertifizierte Ware (Fairtrade, RSPO, MSC, UTZ). */
export const ZERTIFIZIERT_FAKTOR = 1.22;
