import { useMemo, useState } from 'react';
import { preisMap, profilFuer, useStore } from '../state/store';
import { Hinweisleiste, Karte, Knopf } from '../components/basis';
import { Tornado } from '../components/diagramme';
import {
  berechneKalkulation,
  berechneTornado,
  euro,
  NEUTRALE_HEBEL,
  prozent,
  stresstest,
  SZENARIO_VORLAGEN,
  zahl,
} from '../lib/costing';
import type { Hebel, Product } from '../lib/costing';

/**
 * Schritt "Simulation": Schieberegler fuer die groessten Stellhebel,
 * Tornado-Analyse, Stresstest und speicherbare Szenarien.
 */
export function SimulationSchritt({ produkt }: { produkt: Product }) {
  const preise = useStore((s) => s.preise);
  const profile = useStore((s) => s.profile);
  const alleSzenarien = useStore((s) => s.szenarien);
  const szenarioSpeichern = useStore((s) => s.szenarioSpeichern);
  const szenarioEntfernen = useStore((s) => s.szenarioEntfernen);

  const profil = profilFuer(produkt, profile);
  const basisEingabe = useMemo(
    () => ({ product: produkt, profile: profil, preise: preisMap(preise) }),
    [produkt, profil, preise],
  );

  const [hebel, setHebel] = useState<Hebel>(NEUTRALE_HEBEL);

  const szenarien = useMemo(
    () => alleSzenarien.filter((sz) => sz.produktId === produkt.id),
    [alleSzenarien, produkt.id],
  );

  const basis = useMemo(
    () => berechneKalkulation({ ...basisEingabe, hebel: NEUTRALE_HEBEL }),
    [basisEingabe],
  );
  const simuliert = useMemo(
    () => berechneKalkulation({ ...basisEingabe, hebel }),
    [basisEingabe, hebel],
  );
  const tornado = useMemo(() => berechneTornado(basisEingabe), [basisEingabe]);
  const stress = useMemo(() => stresstest(basisEingabe), [basisEingabe]);

  const delta = simuliert.vollkosten - basis.vollkosten;
  const deltaProzent = basis.vollkosten > 0 ? (delta / basis.vollkosten) * 100 : 0;

  const regler: {
    schluessel: keyof Hebel;
    label: string;
    min: number;
    max: number;
    schritt: number;
    format: (v: number) => string;
  }[] = [
    {
      schluessel: 'rohstoffpreisFaktor',
      label: 'Rohstoffpreise',
      min: 0.6,
      max: 1.6,
      schritt: 0.01,
      format: (v) => `${v >= 1 ? '+' : ''}${zahl((v - 1) * 100, 0)} %`,
    },
    {
      schluessel: 'verpackungFaktor',
      label: 'Verpackungskosten',
      min: 0.6,
      max: 1.6,
      schritt: 0.01,
      format: (v) => `${v >= 1 ? '+' : ''}${zahl((v - 1) * 100, 0)} %`,
    },
    {
      schluessel: 'ausbringungFaktor',
      label: 'Linienleistung',
      min: 0.5,
      max: 1.8,
      schritt: 0.01,
      format: (v) => `${zahl(profil.ausbringungJeStunde * v, 0)} VE/h`,
    },
    {
      schluessel: 'losgroesseFaktor',
      label: 'Losgröße',
      min: 0.25,
      max: 4,
      schritt: 0.05,
      format: (v) => `${zahl(profil.losgroesseVe * v, 0)} VE`,
    },
    {
      schluessel: 'gemeinkostenFaktor',
      label: 'Gemeinkostensätze',
      min: 0.6,
      max: 1.6,
      schritt: 0.01,
      format: (v) => `${v >= 1 ? '+' : ''}${zahl((v - 1) * 100, 0)} %`,
    },
  ];

  return (
    <div className="space-y-4">
      <Karte titel="Wirkung der Annahmen">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[11px] text-slate-500">Basis</p>
            <p className="text-base font-semibold tabellenzahl text-slate-900">
              {euro(basis.vollkosten)}
            </p>
          </div>
          <div className="rounded-lg bg-marke-50 p-2.5">
            <p className="text-[11px] text-marke-800">Simulation</p>
            <p className="text-base font-semibold tabellenzahl text-marke-900">
              {euro(simuliert.vollkosten)}
            </p>
          </div>
          <div
            className={`rounded-lg p-2.5 ${
              Math.abs(deltaProzent) < 0.05
                ? 'bg-slate-50'
                : delta > 0
                  ? 'bg-red-50'
                  : 'bg-emerald-50'
            }`}
          >
            <p className="text-[11px] text-slate-500">Differenz</p>
            <p className="text-base font-semibold tabellenzahl text-slate-900">
              {delta >= 0 ? '+' : ''}
              {euro(delta)}
            </p>
            <p className="text-[10px] tabellenzahl text-slate-500">
              {delta >= 0 ? '+' : ''}
              {zahl(deltaProzent, 1)} %
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {regler.map((r) => {
            const wert = hebel[r.schluessel] as number;
            return (
              <label key={r.schluessel} className="block">
                <span className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{r.label}</span>
                  <span className="tabellenzahl text-slate-500">{r.format(wert)}</span>
                </span>
                <input
                  type="range"
                  className="w-full"
                  min={r.min}
                  max={r.max}
                  step={r.schritt}
                  value={wert}
                  onChange={(e) =>
                    setHebel((h) => ({ ...h, [r.schluessel]: Number(e.target.value) }))
                  }
                />
              </label>
            );
          })}

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Gewinnzuschlag</span>
              <span className="tabellenzahl text-slate-500">
                {prozent(hebel.gewinnzuschlagProzent ?? profil.gewinnzuschlagProzent)}
              </span>
            </span>
            <input
              type="range"
              className="w-full"
              min={0}
              max={30}
              step={0.5}
              value={hebel.gewinnzuschlagProzent ?? profil.gewinnzuschlagProzent}
              onChange={(e) =>
                setHebel((h) => ({ ...h, gewinnzuschlagProzent: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Knopf onClick={() => setHebel(NEUTRALE_HEBEL)}>Zurücksetzen</Knopf>
          {SZENARIO_VORLAGEN.map((v) => (
            <Knopf key={v.typ} onClick={() => setHebel(v.hebel)}>
              {v.name}
            </Knopf>
          ))}
        </div>
      </Karte>

      <Karte titel="Stresstest">
        <Hinweisleiste art={stress.deltaProzent > 8 ? 'warnung' : 'info'}>
          <strong>{stress.name}:</strong> Die Vollkosten steigen von{' '}
          {euro(stress.vollkostenBasis)} auf {euro(stress.vollkostenStress)} – ein Plus von{' '}
          {euro(stress.deltaAbsolut)} je Verkaufseinheit ({prozent(stress.deltaProzent)}).
        </Hinweisleiste>
        <div className="mt-3 flex gap-2">
          <Knopf onClick={() => setHebel((h) => ({ ...h, rohstoffpreisFaktor: 1.2 }))}>
            Stresstest in die Simulation übernehmen
          </Knopf>
        </div>
      </Karte>

      <Karte titel="Tornado – Hebelwirkung auf die Vollkosten">
        <Tornado
          zeilen={tornado.map((t) => ({
            label: t.label,
            beschreibung: t.beschreibung,
            niedrig: t.niedrig,
            hoch: t.hoch,
            basis: t.basis,
          }))}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Jede Annahme wird einzeln variiert, alle übrigen bleiben unverändert. Die längste Zeile
          zeigt, wo eine Nachrecherche den größten Unterschied macht:{' '}
          <strong className="font-medium text-slate-700">{tornado[0]?.label}</strong> mit einer
          Spanne von {euro(tornado[0]?.spanne ?? 0)} je VE.
        </p>
      </Karte>

      <Karte titel="Szenarien">
        <div className="flex flex-wrap gap-2">
          {SZENARIO_VORLAGEN.map((v) => (
            <Knopf
              key={v.typ}
              onClick={() => szenarioSpeichern(produkt.id, v.name, v.typ, v.typ === 'base' ? hebel : v.hebel)}
            >
              {v.name} speichern
            </Knopf>
          ))}
          <Knopf
            variante="primaer"
            onClick={() =>
              szenarioSpeichern(
                produkt.id,
                `Variante ${szenarien.length + 1}`,
                'frei',
                hebel,
              )
            }
          >
            Aktuelle Einstellung speichern
          </Knopf>
        </div>

        {szenarien.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Szenario</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Vollkosten</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Abgabepreis</th>
                  <th className="py-1.5 text-right font-medium">Δ Basis</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {szenarien.map((sz) => {
                  const c = berechneKalkulation({ ...basisEingabe, hebel: sz.hebel });
                  const d = c.vollkosten - basis.vollkosten;
                  return (
                    <tr key={sz.id}>
                      <td className="py-1.5 pr-2">
                        <button
                          onClick={() => setHebel(sz.hebel)}
                          className="text-slate-800 hover:text-marke-700 hover:underline"
                        >
                          {sz.name}
                        </button>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabellenzahl text-slate-800">
                        {euro(c.vollkosten)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabellenzahl text-slate-600">
                        {euro(c.abgabepreis)}
                      </td>
                      <td
                        className={`py-1.5 text-right tabellenzahl ${
                          d > 0 ? 'text-red-700' : d < 0 ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {d >= 0 ? '+' : ''}
                        {euro(d)}
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <button
                          onClick={() => szenarioEntfernen(sz.id)}
                          className="text-[11px] text-slate-400 hover:text-red-600"
                          aria-label={`${sz.name} löschen`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-slate-500">
            Noch keine Szenarien gespeichert. Best Case, Base Case und Worst Case lassen sich mit
            einem Tippen anlegen und danach nebeneinander vergleichen.
          </p>
        )}
      </Karte>
    </div>
  );
}
