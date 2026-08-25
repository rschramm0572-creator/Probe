import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { ErfassungScreen } from './screens/Erfassung';
import { BibliothekScreen } from './screens/Bibliothek';
import { VergleichScreen } from './screens/Vergleich';
import { StammdatenScreen } from './screens/Stammdaten';
import { EinstellungenBlatt } from './screens/Einstellungen';
import { Hinweisleiste } from './components/basis';

type Reiter = 'erfassen' | 'bibliothek' | 'vergleich' | 'stammdaten';

const REITER: { id: Reiter; text: string; symbol: string }[] = [
  { id: 'erfassen', text: 'Erfassen', symbol: '◎' },
  { id: 'bibliothek', text: 'Bibliothek', symbol: '▤' },
  { id: 'vergleich', text: 'Vergleich', symbol: '⊞' },
  { id: 'stammdaten', text: 'Stammdaten', symbol: '⚙' },
];

export function App() {
  const laden = useStore((s) => s.laden);
  const geladen = useStore((s) => s.geladen);
  const fehler = useStore((s) => s.fehler);
  const setzeFehler = useStore((s) => s.setzeFehler);
  const nachholen = useStore((s) => s.offeneAnalysenNachholen);
  const vergleichIds = useStore((s) => s.vergleichIds);

  const [reiter, setReiter] = useState<Reiter>('erfassen');
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    void laden();
  }, [laden]);

  // Offline erfasste Produkte werden analysiert, sobald die Verbindung steht.
  useEffect(() => {
    const rein = () => {
      setOnline(true);
      void nachholen();
    };
    const raus = () => setOnline(false);
    window.addEventListener('online', rein);
    window.addEventListener('offline', raus);
    return () => {
      window.removeEventListener('online', rein);
      window.removeEventListener('offline', raus);
    };
  }, [nachholen]);

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight text-slate-900">KalkuLens</span>
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              Produktkalkulation vom Regal bis zur Vollkostenrechnung
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                offline
              </span>
            )}
            <button
              onClick={() => setEinstellungenOffen(true)}
              className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              aria-label="Einstellungen"
              title="Einstellungen"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {fehler && (
          <div className="mb-3">
            <Hinweisleiste art="warnung">
              <div className="flex items-start justify-between gap-3">
                <span>{fehler}</span>
                <button onClick={() => setzeFehler(null)} className="shrink-0 underline">
                  ausblenden
                </button>
              </div>
            </Hinweisleiste>
          </div>
        )}

        {!geladen ? (
          <p className="py-16 text-center text-sm text-slate-500">Lade lokale Daten …</p>
        ) : reiter === 'erfassen' ? (
          <ErfassungScreen onEinstellungen={() => setEinstellungenOffen(true)} />
        ) : reiter === 'bibliothek' ? (
          <BibliothekScreen onOeffnen={() => setReiter('erfassen')} onVergleich={() => setReiter('vergleich')} />
        ) : reiter === 'vergleich' ? (
          <VergleichScreen onBibliothek={() => setReiter('bibliothek')} />
        ) : (
          <StammdatenScreen />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-3xl">
          {REITER.map((r) => {
            const aktiv = reiter === r.id;
            return (
              <li key={r.id} className="flex-1">
                <button
                  onClick={() => setReiter(r.id)}
                  className={`flex w-full flex-col items-center gap-0.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[11px] font-medium transition-colors ${
                    aktiv ? 'text-marke-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  aria-current={aktiv ? 'page' : undefined}
                >
                  <span className={`text-lg leading-5 ${aktiv ? '' : 'opacity-70'}`}>{r.symbol}</span>
                  <span className="flex items-center gap-1">
                    {r.text}
                    {r.id === 'vergleich' && vergleichIds.length > 0 && (
                      <span className="rounded-full bg-marke-600 px-1.5 text-[10px] leading-4 text-white">
                        {vergleichIds.length}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <EinstellungenBlatt offen={einstellungenOffen} onSchliessen={() => setEinstellungenOffen(false)} />
    </div>
  );
}
