import { useMemo, useState } from 'react';
import { preisMap, profilFuer, useStore } from '../state/store';
import {
  Blatt,
  Hinweisleiste,
  Karte,
  KonfidenzBadge,
  Knopf,
  SCHAETZ_HINWEIS,
} from '../components/basis';
import { Kostenwasserfall, TreiberBalken, type WasserfallPunkt } from '../components/diagramme';
import {
  berechneKalkulation,
  berechneLosgroessen,
  euro,
  euroAuto,
  gramm,
  ingredientName,
  produktTitel,
  prozent,
  zahl,
  LOSGROESSEN_STUFEN,
} from '../lib/costing';
import type { Calculation, KostenPosition, Product, RecipeLine } from '../lib/costing';

/** Schritt "Ergebnis": Wasserfall, Rezeptur und Rueckwaertskalkulation. */
export function ErgebnisSchritt({
  produkt,
  onSimulation,
}: {
  produkt: Product;
  onSimulation: () => void;
}) {
  const preise = useStore((s) => s.preise);
  const profile = useStore((s) => s.profile);
  const vergleichUmschalten = useStore((s) => s.vergleichUmschalten);
  const imVergleich = useStore((s) => s.vergleichIds.includes(produkt.id));

  const profil = profilFuer(produkt, profile);
  const calc = useMemo(
    () => berechneKalkulation({ product: produkt, profile: profil, preise: preisMap(preise) }),
    [produkt, profil, preise],
  );

  const [herleitung, setHerleitung] = useState<KostenPosition | null>(null);
  const [exportFehler, setExportFehler] = useState<string | null>(null);
  const [exportLaeuft, setExportLaeuft] = useState<'excel' | 'pdf' | null>(null);

  // Excel- und PDF-Erzeugung ziehen schwere Bibliotheken nach. Sie werden erst
  // beim Klick geladen – die App startet im Markt sonst spuerbar langsamer.
  const exportiere = async (art: 'excel' | 'pdf') => {
    setExportLaeuft(art);
    setExportFehler(null);
    try {
      if (art === 'excel') {
        const { exportiereExcel } = await import('../lib/export/excel');
        exportiereExcel(produkt, calc, profil);
      } else {
        const { exportierePdf } = await import('../lib/export/pdf');
        exportierePdf(produkt, calc, profil);
      }
    } catch (f) {
      setExportFehler(
        f instanceof Error ? f.message : 'Der Export ist fehlgeschlagen.',
      );
    } finally {
      setExportLaeuft(null);
    }
  };

  return (
    <div className="space-y-4">
      <Kopfzahlen calc={calc} produkt={produkt} />

      <Karte titel="Kostenwasserfall je Verkaufseinheit" dicht>
        <div className="px-2 pt-3">
          <Kostenwasserfall
            punkte={wasserfallPunkte(calc)}
            onAuswahl={(label) => {
              const pos = calc.positionen.find((p) => p.label === label);
              if (pos) setHerleitung(pos);
            }}
          />
        </div>
        <p className="px-4 pb-3 text-[11px] text-slate-500">
          Auf einen Balken tippen, um die Herleitung zu sehen.
        </p>
      </Karte>

      <KostenTabelle calc={calc} onZeile={setHerleitung} />
      <RezepturTabelle produkt={produkt} calc={calc} />

      <Karte titel="Größte Kostentreiber der Rohware">
        <TreiberBalken
          daten={calc.rohwaren
            .filter((r) => r.kostenJeVe > 0)
            .slice(0, 5)
            .map((r) => ({ name: r.name, kosten: r.kostenJeVe, anteil: r.anteilAnRohware }))}
        />
        {calc.rohwaren.every((r) => r.kostenJeVe <= 0) && (
          <p className="text-[13px] text-slate-500">
            Für keine Zutat liegt ein Einkaufspreis vor. Rohstoffe im Schritt „Prüfen“ zuordnen.
          </p>
        )}
      </Karte>

      <VerpackungTabelle calc={calc} />
      <Losgroessen produkt={produkt} />
      {calc.rueckwaerts && <Rueckwaerts calc={calc} />}
      <Handelsstufe calc={calc} />

      {exportFehler && <Hinweisleiste art="fehler">{exportFehler}</Hinweisleiste>}

      <div className="grid gap-2 sm:grid-cols-2">
        <Knopf disabled={exportLaeuft !== null} onClick={() => void exportiere('excel')}>
          {exportLaeuft === 'excel' ? 'Erzeuge Excel …' : '▤ Excel-Kalkulationsblatt'}
        </Knopf>
        <Knopf disabled={exportLaeuft !== null} onClick={() => void exportiere('pdf')}>
          {exportLaeuft === 'pdf' ? 'Erzeuge PDF …' : '▦ PDF-Summary'}
        </Knopf>
        <Knopf variante="primaer" onClick={onSimulation}>
          ◭ Annahmen simulieren
        </Knopf>
        <Knopf onClick={() => vergleichUmschalten(produkt.id)}>
          {imVergleich ? '✓ Im Vergleich' : '⊞ Zum Vergleich hinzufügen'}
        </Knopf>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">{SCHAETZ_HINWEIS}</p>

      <Blatt
        offen={herleitung !== null}
        titel={herleitung?.label ?? ''}
        onSchliessen={() => setHerleitung(null)}
      >
        {herleitung && (
          <div className="space-y-3">
            <p className="text-2xl font-semibold tabellenzahl text-slate-900">
              {euroAuto(herleitung.betrag)}
              <span className="ml-2 text-sm font-normal text-slate-500">je Verkaufseinheit</span>
            </p>
            <div className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
              {herleitung.herleitung}
            </div>
            {herleitung.basis !== undefined && herleitung.satz !== undefined && (
              <p className="text-[12px] text-slate-500">
                Rechenweg: {euroAuto(herleitung.basis)} × {prozent(herleitung.satz)} ={' '}
                {euroAuto(herleitung.betrag)}
              </p>
            )}
            <p className="text-[12px] text-slate-500">
              Anteil an den Vollkosten:{' '}
              {prozent((herleitung.betrag / Math.max(calc.vollkosten, 1e-9)) * 100)}
            </p>
          </div>
        )}
      </Blatt>
    </div>
  );
}

export function wasserfallPunkte(calc: Calculation): WasserfallPunkt[] {
  const kurz: Record<string, string> = {
    rohware: 'Rohware',
    verpackung: 'Verpackung',
    mgk: 'Material-GK',
    fek: 'Fertigung EK',
    fgk: 'Fertigung GK',
    hk: 'Herstellk.',
    qs: 'QS',
    fue: 'F&E',
    verwaltung: 'Verwaltung',
    vertrieb: 'Vertrieb',
    logistik: 'Logistik',
    vollkosten: 'Vollkosten',
  };
  return calc.positionen
    .filter((p) => kurz[p.schluessel])
    .map((p) => ({
      label: p.label,
      kurz: kurz[p.schluessel],
      betrag: p.betrag,
      summe: !!p.summe,
      herleitung: p.herleitung,
    }));
}

function Kopfzahlen({ calc, produkt }: { calc: Calculation; produkt: Product }) {
  const kacheln = [
    {
      titel: 'Vollkosten je VE',
      wert: euro(calc.vollkosten),
      zusatz: `${euro(calc.vollkostenMin)} – ${euro(calc.vollkostenMax)}`,
    },
    {
      titel: 'Herstellkosten',
      wert: euro(calc.herstellkosten),
      zusatz: `Rohware ${prozent((calc.rohwarenkosten / Math.max(calc.vollkosten, 1e-9)) * 100, 0)}`,
    },
    {
      titel: 'Abgabepreis',
      wert: euro(calc.abgabepreis),
      zusatz: 'inkl. Gewinnzuschlag',
    },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {kacheln.map((k) => (
          <div key={k.titel} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] text-slate-500">{k.titel}</p>
            <p className="mt-0.5 text-lg font-semibold tabellenzahl leading-tight text-slate-900">
              {k.wert}
            </p>
            <p className="mt-0.5 text-[10px] tabellenzahl text-slate-500">{k.zusatz}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          Gesamtkonfidenz <KonfidenzBadge wert={calc.konfidenz} klein />
        </span>
        <span>Einsatzmenge {gramm(calc.einsatzmengeG, 0)}</span>
        <span>{produkt.recipe.lines.length} Zutaten</span>
        {produkt.recipe.fit?.deklariert && (
          <span>Nährwertabweichung max. {prozent(produkt.recipe.fit.maxAbweichungProzent)}</span>
        )}
      </div>
    </div>
  );
}

function KostenTabelle({
  calc,
  onZeile,
}: {
  calc: Calculation;
  onZeile: (p: KostenPosition) => void;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <Karte
      titel="Kalkulationsschema"
      aktion={
        <button onClick={() => setOffen((o) => !o)} className="text-xs text-marke-700 hover:underline">
          {offen ? 'einklappen' : 'aufklappen'}
        </button>
      }
      dicht
    >
      {offen && (
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-slate-100">
            {calc.positionen.map((p) => (
              <tr
                key={p.schluessel}
                onClick={() => onZeile(p)}
                className={`cursor-pointer hover:bg-slate-50 ${p.summe ? 'bg-slate-50/60' : ''}`}
              >
                <td className={`py-2 pl-4 pr-2 ${p.summe ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                  {p.label}
                </td>
                <td
                  className={`py-2 pr-4 text-right tabellenzahl ${
                    p.summe ? 'font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {euroAuto(p.betrag)}
                </td>
                <td className="w-6 pr-3 text-right text-slate-300">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!offen && (
        <p className="px-4 py-3 text-[12px] text-slate-500">
          Vollkosten {euro(calc.vollkosten)} je VE. Aufklappen zeigt jede Position – jede Zeile lässt
          sich bis auf ihre Annahme zurückverfolgen.
        </p>
      )}
    </Karte>
  );
}

function RezepturTabelle({ produkt, calc }: { produkt: Product; calc: Calculation }) {
  const anteilSetzen = useStore((s) => s.anteilSetzen);
  const fixierungLoesen = useStore((s) => s.fixierungLoesen);
  const [offen, setOffen] = useState(true);
  const [bearbeite, setBearbeite] = useState<RecipeLine | null>(null);
  const [entwurf, setEntwurf] = useState('');

  const kosten = new Map(calc.rohwaren.map((r) => [r.lineId, r]));
  if (produkt.recipe.lines.length === 0) {
    return (
      <Karte titel="Rezepturschätzung">
        <p className="text-[13px] text-slate-500">
          Keine Zutatenliste erfasst. Im Schritt „Prüfen“ den Wortlaut vom Etikett eintragen.
        </p>
      </Karte>
    );
  }

  return (
    <Karte
      titel="Rezepturschätzung"
      aktion={
        <button onClick={() => setOffen((o) => !o)} className="text-xs text-marke-700 hover:underline">
          {offen ? 'einklappen' : 'aufklappen'}
        </button>
      }
      dicht
    >
      {offen && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pl-4 pr-2 font-medium">Zutat</th>
                <th className="py-2 pr-2 text-right font-medium">Anteil</th>
                <th className="py-2 pr-2 text-right font-medium">Bandbreite</th>
                <th className="py-2 pr-2 text-right font-medium">g/VE</th>
                <th className="py-2 pr-4 text-right font-medium">€/VE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produkt.recipe.lines.map((l) => {
                const k = kosten.get(l.id);
                return (
                  <tr
                    key={l.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      setBearbeite(l);
                      setEntwurf(zahl(l.anteil, 1));
                    }}
                  >
                    <td className="py-2 pl-4 pr-2">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-slate-800">{l.etikettName}</span>
                        {l.quid !== null && (
                          <span className="rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">
                            QUID
                          </span>
                        )}
                        {l.fixiert && l.quid === null && (
                          <span className="rounded bg-marke-50 px-1 text-[10px] text-marke-700">fix</span>
                        )}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {ingredientName(l.ingredientId)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 tabellenzahl ${
                          l.fixiert ? 'feld-bestaetigt' : 'feld-geschaetzt'
                        }`}
                      >
                        {zahl(l.anteil, 1)} %
                      </span>
                      <span className="mt-0.5 block">
                        <KonfidenzBadge wert={l.konfidenz} klein />
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabellenzahl text-slate-500">
                      {zahl(l.min, 1)}–{zahl(l.max, 1)}
                    </td>
                    <td className="py-2 pr-2 text-right tabellenzahl text-slate-600">
                      {zahl(k?.grammJeVe ?? 0, 1)}
                    </td>
                    <td className="py-2 pr-4 text-right tabellenzahl text-slate-800">
                      {euroAuto(k?.kostenJeVe ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold">
                <td className="py-2 pl-4 pr-2 text-slate-900">Summe</td>
                <td className="py-2 pr-2 text-right tabellenzahl text-slate-900">
                  {zahl(
                    produkt.recipe.lines.reduce((s, l) => s + l.anteil, 0),
                    1,
                  )}{' '}
                  %
                </td>
                <td />
                <td className="py-2 pr-2 text-right tabellenzahl text-slate-700">
                  {zahl(calc.einsatzmengeG, 0)}
                </td>
                <td className="py-2 pr-4 text-right tabellenzahl text-slate-900">
                  {euro(calc.rohwarenkosten)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Blatt
        offen={bearbeite !== null}
        titel={bearbeite?.etikettName ?? ''}
        onSchliessen={() => setBearbeite(null)}
      >
        {bearbeite && (
          <div className="space-y-4">
            {bearbeite.quid !== null ? (
              <Hinweisleiste art="info">
                Dieser Anteil ist als QUID-Angabe auf dem Etikett deklariert ({zahl(bearbeite.quid, 1)} %)
                und gilt als Fixpunkt. Er wird von der Optimierung nicht verändert.
              </Hinweisleiste>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Anteil überschreiben
                  </span>
                  <span className="flex items-center rounded-lg border border-slate-300 bg-white">
                    <input
                      autoFocus
                      inputMode="decimal"
                      className="w-full bg-transparent px-3 py-2.5 text-sm outline-none tabellenzahl"
                      value={entwurf}
                      onChange={(e) => setEntwurf(e.target.value)}
                    />
                    <span className="pr-3 text-xs text-slate-500">%</span>
                  </span>
                </label>
                <p className="text-[12px] text-slate-500">
                  Zulässiger Korridor nach Reihenfolgeregel und Kategoriewissen:{' '}
                  {zahl(bearbeite.min, 1)} – {zahl(bearbeite.max, 1)} %. Ein überschriebener Wert wird
                  fixiert; die übrigen Anteile werden neu normiert.
                </p>
                <div className="flex gap-2">
                  <Knopf
                    variante="primaer"
                    onClick={() => {
                      const v = Number(entwurf.replace(',', '.'));
                      if (Number.isFinite(v)) anteilSetzen(produkt.id, bearbeite.id, v);
                      setBearbeite(null);
                    }}
                  >
                    Übernehmen und fixieren
                  </Knopf>
                  {bearbeite.fixiert && (
                    <Knopf
                      onClick={() => {
                        fixierungLoesen(produkt.id, bearbeite.id);
                        setBearbeite(null);
                      }}
                    >
                      Fixierung lösen
                    </Knopf>
                  )}
                </div>
              </>
            )}
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <Zeile begriff="Rohstoff" wert={ingredientName(bearbeite.ingredientId)} />
              <Zeile begriff="Konfidenz" wert={prozent(bearbeite.konfidenz * 100, 0)} />
              <Zeile begriff="Menge je VE" wert={gramm(kosten.get(bearbeite.id)?.grammJeVe ?? 0)} />
              <Zeile
                begriff="Einkaufspreis"
                wert={`${zahl(kosten.get(bearbeite.id)?.preisJeKg ?? 0, 2)} €/kg`}
              />
            </dl>
          </div>
        )}
      </Blatt>
    </Karte>
  );
}

function Zeile({ begriff, wert }: { begriff: string; wert: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] text-slate-500">{begriff}</dt>
      <dd className="tabellenzahl text-slate-800">{wert}</dd>
    </div>
  );
}

function VerpackungTabelle({ calc }: { calc: Calculation }) {
  return (
    <Karte titel="Verpackungskosten je Verkaufseinheit" dicht>
      <table className="w-full text-[12px]">
        <tbody className="divide-y divide-slate-100">
          {calc.verpackungPositionen.map((v) => (
            <tr key={v.spec.id}>
              <td className="py-2 pl-4 pr-2 text-slate-700">
                <span className="mr-1.5 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">
                  {{ primaer: 'P', sekundaer: 'S', tertiaer: 'T' }[v.spec.ebene]}
                </span>
                {v.spec.bezeichnung}
                {v.spec.geschaetzt && (
                  <span className="ml-1.5 text-[10px] text-amber-700">geschätzt</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right tabellenzahl text-slate-800">
                {euroAuto(v.kostenJeVe)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50/60 font-semibold">
            <td className="py-2 pl-4 pr-2 text-slate-900">Summe</td>
            <td className="py-2 pr-4 text-right tabellenzahl text-slate-900">
              {euro(calc.verpackungskosten)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="px-4 pb-3 pt-2 text-[11px] text-slate-500">
        Davon Lizenzentgelt Duales System {euroAuto(calc.lizenzentgelt)} je VE.
      </p>
    </Karte>
  );
}

function Losgroessen({ produkt }: { produkt: Product }) {
  const preise = useStore((s) => s.preise);
  const profile = useStore((s) => s.profile);
  const aendereProdukt = useStore((s) => s.aendereProdukt);
  const profil = profilFuer(produkt, profile);

  const stufen = useMemo(
    () => berechneLosgroessen({ product: produkt, profile: profil, preise: preisMap(preise) }),
    [produkt, profil, preise],
  );

  return (
    <Karte titel="Stückkosten nach Jahresmenge">
      <div className="grid grid-cols-3 gap-2">
        {stufen.map((s) => {
          const aktiv = produkt.jahresmengeVe === s.jahresmengeVe;
          return (
            <button
              key={s.jahresmengeVe}
              onClick={() => aendereProdukt(produkt.id, (p) => ({ ...p, jahresmengeVe: s.jahresmengeVe }))}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                aktiv ? 'border-marke-500 bg-marke-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-[11px] text-slate-500">{zahl(s.jahresmengeVe, 0)} VE p. a.</p>
              <p className="mt-0.5 text-sm font-semibold tabellenzahl text-slate-900">
                {euro(s.vollkosten)}
              </p>
              <p className="text-[10px] tabellenzahl text-slate-500">
                HK {euro(s.herstellkosten)}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Angenommen wird ein Los von einem Zwölftel der Jahresmenge. Rüst- und
        Fertigungsgemeinkosten verteilen sich degressiv darauf; die Rohwarenkosten bleiben
        unverändert. Stufen: {LOSGROESSEN_STUFEN.map((s) => zahl(s, 0)).join(' / ')} VE.
      </p>
    </Karte>
  );
}

function Rueckwaerts({ calc }: { calc: Calculation }) {
  const r = calc.rueckwaerts!;
  const positiv = r.margeAbsolut >= 0;
  return (
    <Karte titel="Rückwärtskalkulation aus dem Regalpreis">
      <ul className="divide-y divide-slate-100 text-[13px]">
        <Posten begriff="Verbraucherabgabepreis brutto" wert={euro(r.vkBrutto)} />
        <Posten begriff="− Mehrwertsteuer" wert={euro(r.vkBrutto - r.vkNetto)} />
        <Posten begriff="= Verbraucherabgabepreis netto" wert={euro(r.vkNetto)} betont />
        <Posten begriff="− Handelsspanne" wert={euro(r.vkNetto - r.nettoNettoEk)} />
        <Posten begriff="= Netto-Netto-Einkaufspreis Handel" wert={euro(r.nettoNettoEk)} betont />
        <Posten begriff="+ Konditionen zurückgerechnet" wert={euro(r.impliziterBlp - r.nettoNettoEk)} />
        <Posten begriff="= Impliziter Abgabepreis Hersteller" wert={euro(r.impliziterBlp)} betont />
        <Posten begriff="− kalkulierte Vollkosten" wert={euro(r.vollkosten)} />
      </ul>
      <div
        className={`mt-3 rounded-lg border p-3 ${
          positiv ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'
        }`}
      >
        <p className="text-[11px] text-slate-600">Geschätzte Herstellermarge</p>
        <p className="text-xl font-semibold tabellenzahl text-slate-900">
          {prozent(r.margeProzent)}
          <span className="ml-2 text-sm font-normal text-slate-600">{euro(r.margeAbsolut)} je VE</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Bandbreite aus der Rezepturunsicherheit: {prozent(r.margeMinProzent)} bis{' '}
          {prozent(r.margeMaxProzent)}
        </p>
      </div>
      {!positiv && (
        <p className="mt-2 text-[11px] text-amber-800">
          Der implizite Abgabepreis liegt unter den kalkulierten Vollkosten. Entweder sind die
          Annahmen zu hoch angesetzt, oder das Produkt wird als Frequenzbringer geführt.
        </p>
      )}
    </Karte>
  );
}

function Handelsstufe({ calc }: { calc: Calculation }) {
  const h = calc.handel;
  if (!h) return null;
  return (
    <Karte titel="Vorwärtsrechnung bis zum Verbraucherpreis">
      <ul className="divide-y divide-slate-100 text-[13px]">
        <Posten begriff="Bruttolistenpreis (BLP)" wert={euro(h.bruttolistenpreis)} betont />
        <Posten begriff="− Konditionen" wert={euro(h.konditionen)} />
        <Posten begriff="= Netto-Netto-Einkaufspreis Handel" wert={euro(h.nettoNettoEk)} betont />
        <Posten begriff="+ Handelsspanne" wert={euro(h.handelsspanne)} />
        <Posten begriff="+ Mehrwertsteuer" wert={euro(h.mehrwertsteuer)} />
        <Posten begriff="= Verbraucherabgabepreis" wert={euro(h.vkBrutto)} betont />
      </ul>
    </Karte>
  );
}

function Posten({ begriff, wert, betont }: { begriff: string; wert: string; betont?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className={betont ? 'font-medium text-slate-900' : 'text-slate-600'}>{begriff}</span>
      <span className={`tabellenzahl ${betont ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {wert}
      </span>
    </li>
  );
}

export { produktTitel };
