import { useState } from 'react';
import { useStore } from '../state/store';
import { Auswahl, Blatt, Hinweisleiste, Knopf, SCHAETZ_HINWEIS } from '../components/basis';
import { MODELL_AUSWAHL, istKonfiguriert, type Effort } from '../lib/vision/analyse';

/** Einstellungen: Zugang zur Bilderkennung und lokale Daten. */
export function EinstellungenBlatt({
  offen,
  onSchliessen,
}: {
  offen: boolean;
  onSchliessen: () => void;
}) {
  const einstellungen = useStore((s) => s.einstellungen);
  const setzen = useStore((s) => s.einstellungenSetzen);
  const allesLoeschen = useStore((s) => s.allesLoeschen);
  const produkte = useStore((s) => s.produkte);

  const [zeigeSchluessel, setZeigeSchluessel] = useState(false);

  return (
    <Blatt offen={offen} titel="Einstellungen" onSchliessen={onSchliessen}>
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-slate-800">Bilderkennung</h3>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Die Etikettenanalyse läuft über die Anthropic Messages API. Der Schlüssel wird
            ausschließlich lokal im Browser gespeichert und mit jeder Anfrage direkt an Anthropic
            gesendet.
          </p>

          <Hinweisleiste art="warnung">
            Ein Schlüssel im Browser ist für den Einzelplatz vertretbar, für den Rollout im
            Außendienst nicht: dort gehört ein eigener Proxy davor, damit der Schlüssel den Server
            nicht verlässt. Das Feld darunter nimmt dessen Basis-URL entgegen.
          </Hinweisleiste>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
              API-Schlüssel
              <button
                onClick={() => setZeigeSchluessel((z) => !z)}
                className="font-normal text-marke-700 hover:underline"
              >
                {zeigeSchluessel ? 'verbergen' : 'anzeigen'}
              </button>
            </span>
            <input
              type={zeigeSchluessel ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[12px] outline-none focus:border-marke-500"
              placeholder="sk-ant-…"
              autoComplete="off"
              value={einstellungen.apiKey}
              onChange={(e) => setzen({ apiKey: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Proxy-Basis-URL (optional)
            </span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[12px] outline-none focus:border-marke-500"
              placeholder="https://kalkulens-proxy.example.com"
              autoComplete="off"
              value={einstellungen.proxyUrl}
              onChange={(e) => setzen({ proxyUrl: e.target.value })}
            />
          </label>

          <Auswahl
            label="Modell"
            wert={einstellungen.model}
            optionen={MODELL_AUSWAHL.map((m) => ({ wert: m.id, text: `${m.label} – ${m.hinweis}` }))}
            onChange={(v) => setzen({ model: v })}
          />

          <Auswahl
            label="Analysetiefe"
            wert={einstellungen.effort}
            optionen={[
              { wert: 'low' as Effort, text: 'niedrig – schnellste Antwort' },
              { wert: 'medium' as Effort, text: 'mittel – empfohlen' },
              { wert: 'high' as Effort, text: 'hoch – für schwer lesbare Etiketten' },
            ]}
            onChange={(v) => setzen({ effort: v })}
          />

          <p className="text-[12px]">
            Status:{' '}
            {istKonfiguriert(einstellungen) ? (
              <span className="font-medium text-emerald-700">einsatzbereit</span>
            ) : (
              <span className="font-medium text-amber-700">
                kein Zugang hinterlegt – Etikettendaten müssen von Hand eingegeben werden
              </span>
            )}
          </p>
        </section>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-[13px] font-semibold text-slate-800">Lokale Daten</h3>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Alle Produkte, Fotos, Preise und Profile liegen ausschließlich in diesem Browser
            (IndexedDB). Es findet keine Übertragung an Dritte statt – abgesehen von den Fotos, die
            zur Analyse an die Anthropic API gesendet werden.
          </p>
          <p className="text-[12px] text-slate-600">
            Gespeichert: {produkte.length} Produkt{produkte.length === 1 ? '' : 'e'}
          </p>
          <Knopf
            variante="gefahr"
            onClick={() => {
              if (confirm('Wirklich alle lokal gespeicherten Daten löschen?')) void allesLoeschen();
            }}
          >
            Alle lokalen Daten löschen
          </Knopf>
        </section>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-[13px] font-semibold text-slate-800">Zum Schätzcharakter</h3>
          <p className="text-[12px] leading-relaxed text-slate-500">{SCHAETZ_HINWEIS}</p>
          <p className="text-[12px] leading-relaxed text-slate-500">
            KalkuLens verarbeitet ausschließlich Angaben, die auf der Verpackung öffentlich lesbar
            sind. Fremde Kalkulationsdaten Dritter werden weder verarbeitet noch gespeichert.
          </p>
        </section>
      </div>
    </Blatt>
  );
}
