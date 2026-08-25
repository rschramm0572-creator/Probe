import { useMemo, useState } from 'react';
import { preisMap, profilFuer, useStore } from '../state/store';
import { Karte, Knopf, Leerzustand, KonfidenzBadge } from '../components/basis';
import { Vorschaubild } from './Erfassung';
import { berechneKalkulation, datumZeit, euro, produktTitel, zahl } from '../lib/costing';
import { KATEGORIE_BY_ID } from '../lib/data/kategorien';
import { erzeugeDemoProdukte } from '../lib/data/demo';

/** Produktbibliothek mit Suche, Filter und Auswahl fuer den Vergleich. */
export function BibliothekScreen({
  onOeffnen,
  onVergleich,
}: {
  onOeffnen: () => void;
  onVergleich: () => void;
}) {
  const produkte = useStore((s) => s.produkte);
  const preise = useStore((s) => s.preise);
  const profile = useStore((s) => s.profile);
  const waehleProdukt = useStore((s) => s.waehleProdukt);
  const entferneProdukt = useStore((s) => s.entferneProdukt);
  const vergleichIds = useStore((s) => s.vergleichIds);
  const vergleichUmschalten = useStore((s) => s.vergleichUmschalten);
  const aendereProdukt = useStore((s) => s.aendereProdukt);

  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('alle');
  const [haendler, setHaendler] = useState('alle');

  const kategorien = useMemo(
    () => [...new Set(produkte.map((p) => p.kategorie.wert))].sort(),
    [produkte],
  );
  const haendlerListe = useMemo(
    () => [...new Set(produkte.map((p) => p.haendler).filter(Boolean))].sort(),
    [produkte],
  );

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return produkte.filter((p) => {
      if (kategorie !== 'alle' && p.kategorie.wert !== kategorie) return false;
      if (haendler !== 'alle' && p.haendler !== haendler) return false;
      if (!s) return true;
      return [p.name.wert, p.marke.wert, p.hersteller.wert, p.ean?.wert, p.haendler]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(s));
    });
  }, [produkte, suche, kategorie, haendler]);

  const kalkulationen = useMemo(() => {
    const index = preisMap(preise);
    return new Map(
      gefiltert.map((p) => [
        p.id,
        berechneKalkulation({ product: p, profile: profilFuer(p, profile), preise: index }),
      ]),
    );
  }, [gefiltert, preise, profile]);

  if (produkte.length === 0) {
    return (
      <Leerzustand
        titel="Die Bibliothek ist leer"
        text="Erfasste Produkte landen automatisch hier – mit Foto, Datum und Ergebnis. Zum Ausprobieren lassen sich zwei Demodatensätze laden."
        aktion={
          <Knopf
            onClick={() => {
              for (const p of erzeugeDemoProdukte()) {
                useStore.setState((s) => ({ produkte: [p, ...s.produkte] }));
                aendereProdukt(p.id, (x) => x);
              }
            }}
          >
            Demodaten laden
          </Knopf>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Karte titel={`Produkte (${gefiltert.length} von ${produkte.length})`}>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marke-500"
          placeholder="Suche nach Produkt, Marke, Hersteller, EAN …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <select
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            value={kategorie}
            onChange={(e) => setKategorie(e.target.value)}
            aria-label="Kategorie filtern"
          >
            <option value="alle">Alle Kategorien</option>
            {kategorien.map((k) => (
              <option key={k} value={k}>
                {KATEGORIE_BY_ID.get(k)?.label ?? k}
              </option>
            ))}
          </select>
          <select
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            value={haendler}
            onChange={(e) => setHaendler(e.target.value)}
            aria-label="Händler filtern"
          >
            <option value="alle">Alle Händler</option>
            {haendlerListe.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </Karte>

      {vergleichIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-marke-200 bg-marke-50 px-4 py-2.5">
          <span className="text-[13px] text-marke-900">
            {vergleichIds.length} Produkt{vergleichIds.length === 1 ? '' : 'e'} im Vergleich
          </span>
          <Knopf variante="primaer" onClick={onVergleich}>
            Vergleich öffnen
          </Knopf>
        </div>
      )}

      <ul className="space-y-2">
        {gefiltert.map((p) => {
          const calc = kalkulationen.get(p.id);
          const gewaehlt = vergleichIds.includes(p.id);
          return (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <Vorschaubild produkt={p} gross />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => {
                      waehleProdukt(p.id);
                      onOeffnen();
                    }}
                    className="block w-full text-left"
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {produktTitel(p)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {KATEGORIE_BY_ID.get(p.kategorie.wert)?.label ?? p.kategorie.wert} ·{' '}
                      {zahl(p.fuellmengeG.wert, 0)} g
                      {p.haendler ? ` · ${p.haendler}` : ''} · {datumZeit(p.erfasstAm)}
                    </span>
                  </button>
                  {calc && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="tabellenzahl font-medium text-slate-900">
                        Vollkosten {euro(calc.vollkosten)}
                      </span>
                      {calc.rueckwaerts && (
                        <span className="tabellenzahl text-slate-600">
                          Marge {zahl(calc.rueckwaerts.margeProzent, 1)} %
                        </span>
                      )}
                      <KonfidenzBadge wert={calc.konfidenz} klein />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <button
                  onClick={() => vergleichUmschalten(p.id)}
                  disabled={!gewaehlt && vergleichIds.length >= 4}
                  className={`text-[12px] ${
                    gewaehlt ? 'font-medium text-marke-700' : 'text-slate-600 hover:text-marke-700'
                  } disabled:opacity-40`}
                >
                  {gewaehlt ? '✓ im Vergleich' : '⊞ zum Vergleich'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`„${produktTitel(p)}“ endgültig löschen?`)) void entferneProdukt(p.id);
                  }}
                  className="text-[12px] text-slate-400 hover:text-red-600"
                >
                  löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
