import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Hinweisleiste, Karte, Knopf, Leerzustand, SCHAETZ_HINWEIS } from '../components/basis';
import { PruefenSchritt } from './Pruefen';
import { ErgebnisSchritt } from './Ergebnis';
import { SimulationSchritt } from './Simulation';
import { verkleinereBild } from '../lib/foto';
import { neueId, produktTitel, datumZeit } from '../lib/costing';
import type { Product, ProductPhoto } from '../lib/costing';
import { erzeugeDemoProdukte } from '../lib/data/demo';
import { istKonfiguriert } from '../lib/vision/analyse';

type Schritt = 'foto' | 'pruefen' | 'ergebnis' | 'simulation';

const SCHRITTE: { id: Schritt; text: string }[] = [
  { id: 'foto', text: 'Foto' },
  { id: 'pruefen', text: 'Prüfen' },
  { id: 'ergebnis', text: 'Ergebnis' },
  { id: 'simulation', text: 'Simulation' },
];

const FOTO_ROLLEN: { rolle: ProductPhoto['rolle']; text: string; hilfe: string }[] = [
  { rolle: 'vorderseite', text: 'Vorderseite', hilfe: 'Marke, Produktname, Füllmenge' },
  { rolle: 'zutaten', text: 'Zutatenliste', hilfe: 'wichtigstes Foto – nah und scharf' },
  { rolle: 'naehrwerte', text: 'Nährwerttabelle', hilfe: 'Spalte „je 100 g“' },
  { rolle: 'rueckseite', text: 'Rückseite / Boden', hilfe: 'Hersteller, EAN, Siegel' },
];

export function ErfassungScreen({ onEinstellungen }: { onEinstellungen: () => void }) {
  const produkte = useStore((s) => s.produkte);
  const aktivId = useStore((s) => s.aktivId);
  const waehleProdukt = useStore((s) => s.waehleProdukt);
  const starteErfassung = useStore((s) => s.starteErfassung);
  const aendereProdukt = useStore((s) => s.aendereProdukt);
  const einstellungen = useStore((s) => s.einstellungen);

  const [schritt, setSchritt] = useState<Schritt>('foto');
  const aktiv = produkte.find((p) => p.id === aktivId) ?? null;

  if (!aktiv) {
    return (
      <StartAnsicht
        onNeu={() => {
          starteErfassung();
          setSchritt('foto');
        }}
        onOeffnen={(id) => {
          waehleProdukt(id);
          setSchritt('ergebnis');
        }}
        onEinstellungen={onEinstellungen}
        konfiguriert={istKonfiguriert(einstellungen)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Schrittleiste
        aktuell={schritt}
        onWechsel={setSchritt}
        produkt={aktiv}
        onSchliessen={() => waehleProdukt(null)}
      />

      {schritt === 'foto' && (
        <FotoSchritt
          produkt={aktiv}
          onWeiter={() => setSchritt('pruefen')}
          onEinstellungen={onEinstellungen}
        />
      )}
      {schritt === 'pruefen' && (
        <PruefenSchritt
          produkt={aktiv}
          onAendern={(f) => aendereProdukt(aktiv.id, f)}
          onWeiter={() => setSchritt('ergebnis')}
        />
      )}
      {schritt === 'ergebnis' && (
        <ErgebnisSchritt produkt={aktiv} onSimulation={() => setSchritt('simulation')} />
      )}
      {schritt === 'simulation' && <SimulationSchritt produkt={aktiv} />}
    </div>
  );
}

function Schrittleiste({
  aktuell,
  onWechsel,
  produkt,
  onSchliessen,
}: {
  aktuell: Schritt;
  onWechsel: (s: Schritt) => void;
  produkt: Product;
  onSchliessen: () => void;
}) {
  const index = SCHRITTE.findIndex((s) => s.id === aktuell);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-800">{produktTitel(produkt)}</p>
        <button onClick={onSchliessen} className="shrink-0 text-xs text-slate-500 hover:text-slate-700">
          schließen
        </button>
      </div>
      <ol className="flex items-center gap-1">
        {SCHRITTE.map((s, i) => {
          const aktiv = s.id === aktuell;
          const erledigt = i < index;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => onWechsel(s.id)}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  aktiv
                    ? 'bg-marke-600 text-white'
                    : erledigt
                      ? 'bg-marke-50 text-marke-700'
                      : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="tabellenzahl opacity-70">{i + 1}</span>
                <span>{s.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StartAnsicht({
  onNeu,
  onOeffnen,
  onEinstellungen,
  konfiguriert,
}: {
  onNeu: () => void;
  onOeffnen: (id: string) => void;
  onEinstellungen: () => void;
  konfiguriert: boolean;
}) {
  const produkte = useStore((s) => s.produkte);
  const aendereProdukt = useStore((s) => s.aendereProdukt);
  const letzte = produkte.slice(0, 3);

  const demoLaden = () => {
    for (const p of erzeugeDemoProdukte()) {
      useStore.setState((s) => ({ produkte: [p, ...s.produkte] }));
      aendereProdukt(p.id, (x) => x);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          Produkt fotografieren – in wenigen Minuten zur belastbaren Kostenhypothese.
        </p>
        <div className="mt-4">
          <Knopf variante="primaer" gross onClick={onNeu} className="w-full sm:w-auto">
            ◎ Neues Produkt erfassen
          </Knopf>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Vorderseite, Zutatenliste, Nährwerttabelle, Rückseite – ein bis vier Fotos genügen.
        </p>
      </div>

      {!konfiguriert && (
        <Hinweisleiste art="warnung">
          Für die automatische Bilderkennung fehlt noch ein API-Schlüssel.{' '}
          <button onClick={onEinstellungen} className="font-medium underline">
            In den Einstellungen hinterlegen
          </button>{' '}
          – oder Etikettendaten von Hand eingeben.
        </Hinweisleiste>
      )}

      {letzte.length > 0 ? (
        <Karte titel="Zuletzt erfasst">
          <ul className="divide-y divide-slate-100">
            {letzte.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOeffnen(p.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <Vorschaubild produkt={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {produktTitel(p)}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {datumZeit(p.erfasstAm)} · {p.recipe.lines.length} Zutaten
                    </span>
                  </span>
                  <span className="text-slate-400">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Karte>
      ) : (
        <Leerzustand
          titel="Noch keine Produkte erfasst"
          text="Fotografieren Sie ein Produkt am Regal – oder laden Sie zwei Demodatensätze, um die Methodik ohne API-Schlüssel nachzuvollziehen."
          aktion={<Knopf onClick={demoLaden}>Demodaten laden</Knopf>}
        />
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">{SCHAETZ_HINWEIS}</p>
    </div>
  );
}

export function Vorschaubild({ produkt, gross }: { produkt: Product; gross?: boolean }) {
  const foto = produkt.fotos.find((f) => f.rolle === 'vorderseite') ?? produkt.fotos[0];
  const groesse = gross ? 'h-16 w-16' : 'h-11 w-11';
  if (!foto) {
    return (
      <span
        className={`flex ${groesse} shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400`}
      >
        ▢
      </span>
    );
  }
  return (
    <img
      src={foto.dataUrl}
      alt=""
      className={`${groesse} shrink-0 rounded-lg object-cover ring-1 ring-slate-200`}
    />
  );
}

function FotoSchritt({
  produkt,
  onWeiter,
  onEinstellungen,
}: {
  produkt: Product;
  onWeiter: () => void;
  onEinstellungen: () => void;
}) {
  const fotoHinzufuegen = useStore((s) => s.fotoHinzufuegen);
  const fotoEntfernen = useStore((s) => s.fotoEntfernen);
  const analysiere = useStore((s) => s.analysiere);
  const einstellungen = useStore((s) => s.einstellungen);
  const [ladend, setLadend] = useState<string | null>(null);

  const laeuft = produkt.analyseStatus === 'laeuft';
  const konfiguriert = istKonfiguriert(einstellungen);
  const hatFotos = produkt.fotos.length > 0;

  return (
    <div className="space-y-4">
      <Karte titel="Fotos erfassen">
        <div className="grid grid-cols-2 gap-3">
          {FOTO_ROLLEN.map((r) => (
            <FotoFeld
              key={r.rolle}
              rolle={r.rolle}
              text={r.text}
              hilfe={r.hilfe}
              foto={produkt.fotos.find((f) => f.rolle === r.rolle) ?? null}
              ladend={ladend === r.rolle}
              onDatei={async (datei) => {
                setLadend(r.rolle);
                try {
                  const dataUrl = await verkleinereBild(datei);
                  fotoHinzufuegen(produkt.id, {
                    id: neueId('f'),
                    rolle: r.rolle,
                    dataUrl,
                    erfasstAm: new Date().toISOString(),
                  });
                } finally {
                  setLadend(null);
                }
              }}
              onEntfernen={(id) => fotoEntfernen(produkt.id, id)}
            />
          ))}
        </div>
      </Karte>

      {produkt.analyseStatus === 'fehler' && produkt.analyseFehler && (
        <Hinweisleiste art="fehler">
          {produkt.analyseFehler}{' '}
          {!konfiguriert && (
            <button onClick={onEinstellungen} className="font-medium underline">
              Einstellungen öffnen
            </button>
          )}
        </Hinweisleiste>
      )}
      {produkt.analyseStatus === 'offen' && (
        <Hinweisleiste art="warnung">
          Ohne Verbindung erfasst. Die Analyse wird automatisch nachgeholt, sobald wieder eine
          Verbindung besteht.
        </Hinweisleiste>
      )}
      {produkt.analyseStatus === 'fertig' && (
        <Hinweisleiste art="erfolg">
          Etikettendaten erkannt. Bitte im nächsten Schritt prüfen und ergänzen.
        </Hinweisleiste>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Knopf
          variante="primaer"
          gross
          className="flex-1"
          disabled={!hatFotos || laeuft}
          onClick={() => void analysiere(produkt.id).then(onWeiter)}
        >
          {laeuft ? 'Analysiere Fotos …' : 'Fotos analysieren'}
        </Knopf>
        <Knopf gross className="flex-1" onClick={onWeiter}>
          Ohne Analyse eingeben
        </Knopf>
      </div>
    </div>
  );
}

function FotoFeld({
  rolle,
  text,
  hilfe,
  foto,
  ladend,
  onDatei,
  onEntfernen,
}: {
  rolle: ProductPhoto['rolle'];
  text: string;
  hilfe: string;
  foto: ProductPhoto | null;
  ladend: boolean;
  onDatei: (datei: File) => void;
  onEntfernen: (id: string) => void;
}) {
  const kamera = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);
  const beschriftung = useMemo(() => `${text} – ${hilfe}`, [text, hilfe]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="mb-1.5 text-[12px] font-medium text-slate-700">{text}</p>
      {foto ? (
        <div className="relative">
          <img
            src={foto.dataUrl}
            alt={beschriftung}
            className="h-28 w-full rounded object-cover ring-1 ring-slate-200"
          />
          <button
            onClick={() => onEntfernen(foto.id)}
            className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-600 shadow"
          >
            entfernen
          </button>
        </div>
      ) : (
        <button
          onClick={() => kamera.current?.click()}
          disabled={ladend}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-300 bg-white text-slate-500 hover:border-marke-400 hover:text-marke-700"
        >
          <span className="text-xl">{ladend ? '…' : '⊕'}</span>
          <span className="px-2 text-center text-[11px] leading-tight">{hilfe}</span>
        </button>
      )}
      <div className="mt-1.5 flex gap-2">
        <button
          onClick={() => kamera.current?.click()}
          className="text-[11px] text-marke-700 hover:underline"
        >
          Kamera
        </button>
        <button
          onClick={() => galerie.current?.click()}
          className="text-[11px] text-slate-500 hover:underline"
        >
          Galerie
        </button>
      </div>
      <input
        ref={kamera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) onDatei(datei);
          e.target.value = '';
        }}
        aria-label={`${beschriftung} fotografieren`}
      />
      <input
        ref={galerie}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) onDatei(datei);
          e.target.value = '';
        }}
        aria-label={`${beschriftung} aus Galerie wählen`}
      />
      <span className="sr-only">{rolle}</span>
    </div>
  );
}
