import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PRUEF_SCHWELLE, parseZahl, prozent, zahl } from '../lib/costing';
import type { Geschaetzt, Quelle } from '../lib/costing';

/** Kleine, wiederverwendbare Bausteine im sachlichen Business-Look. */

export function Karte({
  titel,
  aktion,
  children,
  dicht,
}: {
  titel?: string;
  aktion?: ReactNode;
  children: ReactNode;
  dicht?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {titel && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-700">{titel}</h2>
          {aktion}
        </header>
      )}
      <div className={dicht ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Knopf({
  children,
  variante = 'sekundaer',
  gross,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primaer' | 'sekundaer' | 'still' | 'gefahr';
  gross?: boolean;
}) {
  const basis =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
  const groesse = gross ? 'px-5 py-3.5 text-base' : 'px-3.5 py-2 text-sm';
  const varianten = {
    primaer: 'bg-marke-600 text-white hover:bg-marke-700 active:bg-marke-800',
    sekundaer: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    still: 'text-marke-700 hover:bg-marke-50',
    gefahr: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  };
  return (
    <button {...rest} className={`${basis} ${groesse} ${varianten[variante]} ${rest.className ?? ''}`}>
      {children}
    </button>
  );
}

/** Konfidenzbadge – die Farbe folgt der Pruefschwelle von 0,7. */
export function KonfidenzBadge({ wert, klein }: { wert: number; klein?: boolean }) {
  const stufe = wert >= 0.85 ? 'hoch' : wert >= PRUEF_SCHWELLE ? 'mittel' : 'niedrig';
  const farbe = {
    hoch: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    mittel: 'bg-slate-100 text-slate-600 border-slate-200',
    niedrig: 'bg-amber-100 text-amber-800 border-amber-300',
  }[stufe];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 tabellenzahl ${farbe} ${
        klein ? 'text-[10px] leading-4' : 'text-[11px] leading-5'
      }`}
      title={`Konfidenz ${prozent(wert * 100, 0)}`}
    >
      {zahl(wert * 100, 0)} %
    </span>
  );
}

export function QuelleBadge({ quelle }: { quelle: Quelle }) {
  const text: Record<Quelle, string> = {
    foto: 'aus Foto',
    nutzer: 'bestätigt',
    geschaetzt: 'geschätzt',
    berechnet: 'berechnet',
  };
  const farbe: Record<Quelle, string> = {
    foto: 'text-marke-700',
    nutzer: 'text-emerald-700',
    geschaetzt: 'text-amber-700',
    berechnet: 'text-slate-500',
  };
  return <span className={`text-[11px] ${farbe[quelle]}`}>{text[quelle]}</span>;
}

/**
 * Eingabefeld fuer einen geschaetzten Wert.
 * Geschaetzte Werte sind gestrichelt umrandet, bestaetigte durchgezogen –
 * eine Bearbeitung durch den Nutzer bestaetigt den Wert automatisch.
 */
export function GeschaetztFeld({
  label,
  wert,
  einheit,
  nachkomma = 0,
  typ = 'text',
  onChange,
  hinweis,
  platzhalter,
}: {
  label: string;
  wert: Geschaetzt<string> | Geschaetzt<number> | null;
  einheit?: string;
  nachkomma?: number;
  typ?: 'text' | 'zahl';
  onChange: (neu: string | number) => void;
  hinweis?: string;
  platzhalter?: string;
}) {
  const anzeige =
    wert === null
      ? ''
      : typ === 'zahl'
        ? zahl(wert.wert as number, nachkomma)
        : String(wert.wert ?? '');

  const [entwurf, setEntwurf] = useState(anzeige);
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => {
    if (!aktiv) setEntwurf(anzeige);
  }, [anzeige, aktiv]);

  const bestaetigt = wert?.quelle === 'nutzer';
  const pruefen = !!wert && !bestaetigt && wert.konfidenz < PRUEF_SCHWELLE;
  const rahmen = bestaetigt ? 'feld-bestaetigt' : pruefen ? 'feld-pruefen' : 'feld-geschaetzt';

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {wert && (
          <span className="flex items-center gap-1.5">
            <QuelleBadge quelle={wert.quelle} />
            <KonfidenzBadge wert={wert.konfidenz} klein />
          </span>
        )}
      </span>
      <span className={`flex items-center rounded-lg ${rahmen} focus-within:border-marke-500`}>
        <input
          className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none tabellenzahl"
          inputMode={typ === 'zahl' ? 'decimal' : 'text'}
          value={entwurf}
          placeholder={platzhalter}
          onFocus={() => setAktiv(true)}
          onChange={(e) => setEntwurf(e.target.value)}
          onBlur={() => {
            setAktiv(false);
            if (typ === 'zahl') {
              const v = parseZahl(entwurf);
              if (v !== null) onChange(v);
              else setEntwurf(anzeige);
            } else if (entwurf !== anzeige) {
              onChange(entwurf);
            }
          }}
        />
        {einheit && <span className="pr-3 text-xs text-slate-500">{einheit}</span>}
      </span>
      {(hinweis || pruefen) && (
        <span className="mt-1 block text-[11px] text-amber-700">
          {hinweis ?? 'Niedrige Erkennungssicherheit – bitte prüfen.'}
        </span>
      )}
    </label>
  );
}

/** Einfaches Zahlenfeld ohne Konfidenzlogik, fuer Stammdaten und Profile. */
export function ZahlFeld({
  label,
  wert,
  einheit,
  nachkomma = 2,
  onChange,
  hinweis,
  schritt,
}: {
  label: string;
  wert: number;
  einheit?: string;
  nachkomma?: number;
  onChange: (v: number) => void;
  hinweis?: string;
  schritt?: number;
}) {
  const anzeige = zahl(wert, nachkomma);
  const [entwurf, setEntwurf] = useState(anzeige);
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => {
    if (!aktiv) setEntwurf(anzeige);
  }, [anzeige, aktiv]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-marke-500">
        <input
          className="w-full bg-transparent px-3 py-2 text-sm outline-none tabellenzahl"
          inputMode="decimal"
          step={schritt}
          value={entwurf}
          onFocus={() => setAktiv(true)}
          onChange={(e) => setEntwurf(e.target.value)}
          onBlur={() => {
            setAktiv(false);
            const v = parseZahl(entwurf);
            if (v !== null) onChange(v);
            else setEntwurf(anzeige);
          }}
        />
        {einheit && <span className="pr-3 text-xs text-slate-500">{einheit}</span>}
      </span>
      {hinweis && <span className="mt-1 block text-[11px] text-slate-500">{hinweis}</span>}
    </label>
  );
}

export function Auswahl<T extends string>({
  label,
  wert,
  optionen,
  onChange,
}: {
  label: string;
  wert: T;
  optionen: { wert: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-marke-500"
        value={wert}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Modales Blatt von unten – auf dem Handy einhaendig bedienbar. */
export function Blatt({
  offen,
  titel,
  onSchliessen,
  children,
}: {
  offen: boolean;
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen, onSchliessen]);

  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onSchliessen}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{titel}</h2>
          <button
            onClick={onSchliessen}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Hinweisleiste({
  art = 'info',
  children,
}: {
  art?: 'info' | 'warnung' | 'fehler' | 'erfolg';
  children: ReactNode;
}) {
  const farben = {
    info: 'border-marke-200 bg-marke-50 text-marke-900',
    warnung: 'border-amber-300 bg-amber-50 text-amber-900',
    fehler: 'border-red-300 bg-red-50 text-red-900',
    erfolg: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${farben[art]}`}>
      {children}
    </div>
  );
}

export function Leerzustand({ titel, text, aktion }: { titel: string; text: string; aktion?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{titel}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{text}</p>
      {aktion && <div className="mt-4 flex justify-center">{aktion}</div>}
    </div>
  );
}

/** Standardhinweis auf den Schaetzcharakter – erscheint in App und Exporten. */
export const SCHAETZ_HINWEIS =
  'Alle Werte sind eine methodisch hergeleitete Schätzung auf Basis öffentlich zugänglicher Etikettenangaben. Sie bilden nicht die tatsächliche Rezeptur oder Kalkulation des Herstellers ab.';
