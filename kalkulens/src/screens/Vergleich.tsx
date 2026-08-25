import { useMemo } from 'react';
import { preisMap, profilFuer, useStore } from '../state/store';
import { Karte, Knopf, Leerzustand, SCHAETZ_HINWEIS } from '../components/basis';
import {
  VergleichLegende,
  VergleichStapel,
  type VergleichZeile,
} from '../components/diagramme';
import { berechneKalkulation, euro, euroAuto, produktTitel, prozent, zahl } from '../lib/costing';
import type { Calculation, Product } from '../lib/costing';

/**
 * Vergleichsansicht: 2–4 Produkte nebeneinander.
 * Markenartikel gegen Handelsmarke ist der Standardfall.
 */
export function VergleichScreen({ onBibliothek }: { onBibliothek: () => void }) {
  const produkte = useStore((s) => s.produkte);
  const vergleichIds = useStore((s) => s.vergleichIds);
  const vergleichLeeren = useStore((s) => s.vergleichLeeren);
  const vergleichUmschalten = useStore((s) => s.vergleichUmschalten);
  const preise = useStore((s) => s.preise);
  const profile = useStore((s) => s.profile);

  const gewaehlt = useMemo(
    () => vergleichIds.map((id) => produkte.find((p) => p.id === id)).filter((p): p is Product => !!p),
    [vergleichIds, produkte],
  );

  const daten = useMemo(() => {
    const index = preisMap(preise);
    return gewaehlt.map((p) => ({
      produkt: p,
      calc: berechneKalkulation({ product: p, profile: profilFuer(p, profile), preise: index }),
    }));
  }, [gewaehlt, preise, profile]);

  if (gewaehlt.length === 0) {
    return (
      <Leerzustand
        titel="Kein Produkt im Vergleich"
        text="Wählen Sie in der Bibliothek zwei bis vier Produkte aus – etwa einen Markenartikel und die passende Handelsmarke."
        aktion={<Knopf onClick={onBibliothek}>Zur Bibliothek</Knopf>}
      />
    );
  }

  const stapel: VergleichZeile[] = daten.map(({ produkt, calc }) => {
    const pos = Object.fromEntries(calc.positionen.map((p) => [p.schluessel, p.betrag]));
    return {
      name: kurzName(produkt),
      rohware: calc.rohwarenkosten,
      verpackung: calc.verpackungskosten,
      fertigung: (pos.fek ?? 0) + (pos.fgk ?? 0),
      materialgemein: pos.mgk ?? 0,
      verwaltungVertrieb: (pos.verwaltung ?? 0) + (pos.vertrieb ?? 0),
      sonstige: (pos.qs ?? 0) + (pos.fue ?? 0) + (pos.logistik ?? 0),
    };
  });

  const zeilen: { label: string; werte: (d: (typeof daten)[number]) => string; betont?: boolean }[] = [
    { label: 'Füllmenge', werte: (d) => `${zahl(d.produkt.fuellmengeG.wert, 0)} g` },
    { label: 'Rohwarenkosten je VE', werte: (d) => euro(d.calc.rohwarenkosten) },
    {
      label: 'Rohwarenkosten je kg',
      werte: (d) =>
        d.produkt.fuellmengeG.wert > 0
          ? euro((d.calc.rohwarenkosten / d.produkt.fuellmengeG.wert) * 1000)
          : '—',
    },
    { label: 'Verpackungskosten je VE', werte: (d) => euroAuto(d.calc.verpackungskosten) },
    { label: 'Herstellkosten', werte: (d) => euro(d.calc.herstellkosten), betont: true },
    { label: 'Vollkosten', werte: (d) => euro(d.calc.vollkosten), betont: true },
    {
      label: 'Vollkosten je kg',
      werte: (d) =>
        d.produkt.fuellmengeG.wert > 0
          ? euro((d.calc.vollkosten / d.produkt.fuellmengeG.wert) * 1000)
          : '—',
    },
    { label: 'Kalkulatorischer Abgabepreis', werte: (d) => euro(d.calc.abgabepreis) },
    {
      label: 'Regalpreis',
      werte: (d) => (d.produkt.regalpreis ? euro(d.produkt.regalpreis.wert) : '—'),
    },
    {
      label: 'Geschätzte Herstellermarge',
      werte: (d) => (d.calc.rueckwaerts ? prozent(d.calc.rueckwaerts.margeProzent) : '—'),
      betont: true,
    },
    { label: 'Gesamtkonfidenz', werte: (d) => prozent(d.calc.konfidenz * 100, 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{gewaehlt.length} Produkte im Vergleich</p>
        <div className="flex gap-2">
          <Knopf onClick={onBibliothek}>Weitere auswählen</Knopf>
          <Knopf onClick={vergleichLeeren}>Leeren</Knopf>
        </div>
      </div>

      <Karte titel="Kostenstruktur je Verkaufseinheit">
        <VergleichStapel daten={stapel} />
        <VergleichLegende />
      </Karte>

      <Karte titel="Gegenüberstellung" dicht>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pl-4 pr-2 font-medium text-slate-500">Kennzahl</th>
                {daten.map((d) => (
                  <th key={d.produkt.id} className="py-2 pr-4 text-right align-bottom">
                    <span className="block max-w-[9rem] truncate font-semibold text-slate-800">
                      {produktTitel(d.produkt)}
                    </span>
                    <button
                      onClick={() => vergleichUmschalten(d.produkt.id)}
                      className="text-[10px] font-normal text-slate-400 hover:text-red-600"
                    >
                      entfernen
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {zeilen.map((z) => {
                const werte = daten.map((d) => z.werte(d));
                const unterschiedlich = new Set(werte).size > 1;
                return (
                  <tr key={z.label} className={z.betont ? 'bg-slate-50/60' : ''}>
                    <td
                      className={`py-2 pl-4 pr-2 ${
                        z.betont ? 'font-medium text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {z.label}
                    </td>
                    {werte.map((w, i) => (
                      <td
                        key={daten[i].produkt.id}
                        className={`py-2 pr-4 text-right tabellenzahl ${
                          z.betont ? 'font-semibold text-slate-900' : 'text-slate-700'
                        } ${unterschiedlich && z.betont ? 'bg-amber-50/60' : ''}`}
                      >
                        {w}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Karte>

      {daten.length >= 2 && <Differenz daten={daten} />}

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">{SCHAETZ_HINWEIS}</p>
    </div>
  );
}

function Differenz({ daten }: { daten: { produkt: Product; calc: Calculation }[] }) {
  const [a, b] = daten;
  const jeKg = (d: { produkt: Product; calc: Calculation }) =>
    d.produkt.fuellmengeG.wert > 0 ? (d.calc.vollkosten / d.produkt.fuellmengeG.wert) * 1000 : 0;
  const diff = jeKg(b) - jeKg(a);
  const relativ = jeKg(a) > 0 ? (diff / jeKg(a)) * 100 : 0;

  return (
    <Karte titel="Kernaussage">
      <p className="text-[13px] leading-relaxed text-slate-700">
        Auf das Kilogramm gerechnet liegen die geschätzten Vollkosten von{' '}
        <strong className="font-semibold">{produktTitel(b.produkt)}</strong> um{' '}
        <strong className="font-semibold tabellenzahl">
          {euro(Math.abs(diff))} ({zahl(Math.abs(relativ), 1)} %)
        </strong>{' '}
        {diff >= 0 ? 'über' : 'unter'} denen von{' '}
        <strong className="font-semibold">{produktTitel(a.produkt)}</strong>.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
        Größter Einzelunterschied: Rohware{' '}
        {euro(
          Math.abs(
            (b.calc.rohwarenkosten / Math.max(b.produkt.fuellmengeG.wert, 1)) * 1000 -
              (a.calc.rohwarenkosten / Math.max(a.produkt.fuellmengeG.wert, 1)) * 1000,
          ),
        )}{' '}
        je kg, Verpackung{' '}
        {euro(Math.abs(b.calc.verpackungskosten - a.calc.verpackungskosten))} je VE.
      </p>
    </Karte>
  );
}

function kurzName(p: Product): string {
  const marke = p.marke.wert?.trim();
  const name = p.name.wert?.trim();
  const text = marke || name || 'Produkt';
  return text.length > 18 ? `${text.slice(0, 17)}…` : text;
}
