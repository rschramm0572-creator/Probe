import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { euro, euroAuto, prozent, zahl } from '../lib/costing';

/**
 * Diagramme der Ergebnisdarstellung.
 *
 * Farbrollen (validierte Referenzpalette):
 *  - Wasserfall und Rohware: eine Hue (Blau) als Magnitudenskala, Summenstufen
 *    in Schiefer – die Farbe traegt hier keine Identitaet, nur Rang.
 *  - Tornado: divergierendes Paar Blau/Rot fuer entlastend/belastend.
 *  - Vergleich: kategoriale Slots in fester Reihenfolge, nie rotiert.
 */

export const FLAECHE = '#ffffff';

export const SERIE = {
  blau: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  gelb: '#eda100',
  magenta: '#e87ba4',
  gruen: '#008300',
};

export const KATEGORIAL = [SERIE.blau, SERIE.orange, SERIE.aqua, SERIE.gelb, SERIE.magenta, SERIE.gruen];

const BLAU_HELL = '#86b6ef';
const BLAU = '#2a78d6';
const SCHIEFER = '#334155';
const ROT = '#d03b3b';

const ACHSE = { fontSize: 11, fill: '#64748b' } as const;

function Tooltipkasten({ titel, zeilen }: { titel: string; zeilen: { text: string; wert: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{titel}</p>
      {zeilen.map((z) => (
        <p key={z.text} className="flex justify-between gap-4 text-slate-600">
          <span>{z.text}</span>
          <span className="tabellenzahl font-medium text-slate-800">{z.wert}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kostenwasserfall
// ---------------------------------------------------------------------------

export interface WasserfallPunkt {
  label: string;
  kurz: string;
  betrag: number;
  /** Zwischensumme statt Zuschlag – wird als Balken vom Nullpunkt gezeichnet. */
  summe: boolean;
  herleitung: string;
}

interface WasserfallZeile extends WasserfallPunkt {
  basis: number;
  hoehe: number;
  ende: number;
}

export function baueWasserfall(punkte: WasserfallPunkt[]): WasserfallZeile[] {
  let lauf = 0;
  return punkte.map((p) => {
    if (p.summe) {
      lauf = p.betrag;
      return { ...p, basis: 0, hoehe: p.betrag, ende: p.betrag };
    }
    const basis = lauf;
    lauf += p.betrag;
    return { ...p, basis, hoehe: p.betrag, ende: lauf };
  });
}

export function Kostenwasserfall({
  punkte,
  onAuswahl,
}: {
  punkte: WasserfallPunkt[];
  onAuswahl?: (label: string) => void;
}) {
  const daten = baueWasserfall(punkte);
  if (daten.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="h-72" style={{ minWidth: Math.max(320, daten.length * 46) }}>
      <ResponsiveContainer>
        <BarChart data={daten} margin={{ top: 18, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%">
          <XAxis
            dataKey="kurz"
            tick={ACHSE}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval={0}
            angle={-42}
            textAnchor="end"
            height={70}
          />
          <YAxis
            tick={ACHSE}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => zahl(v, 2)}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const z = payload[0].payload as WasserfallZeile;
              return (
                <div className="max-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-semibold text-slate-800">{z.label}</p>
                  <p className="flex justify-between gap-4 text-slate-600">
                    <span>{z.summe ? 'Summe' : 'Betrag'}</span>
                    <span className="tabellenzahl font-medium text-slate-800">{euroAuto(z.betrag)}</span>
                  </p>
                  {!z.summe && (
                    <p className="flex justify-between gap-4 text-slate-600">
                      <span>Stand danach</span>
                      <span className="tabellenzahl font-medium text-slate-800">{euroAuto(z.ende)}</span>
                    </p>
                  )}
                  <p className="mt-1.5 border-t border-slate-100 pt-1.5 leading-snug text-slate-500">
                    {z.herleitung}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="basis" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="hoehe"
            stackId="a"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            onClick={(d: unknown) => onAuswahl?.((d as WasserfallZeile).label)}
            cursor={onAuswahl ? 'pointer' : undefined}
          >
            {daten.map((z) => (
              <Cell key={z.label} fill={z.summe ? SCHIEFER : z.betrag >= 0 ? BLAU : ROT} />
            ))}
            <LabelList
              dataKey="hoehe"
              position="top"
              formatter={(v: unknown) =>
                typeof v === 'number' && Math.abs(v) >= 0.005 ? zahl(v, 2) : ''
              }
              style={{ fontSize: 10, fill: '#475569' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kostentreiber
// ---------------------------------------------------------------------------

export function TreiberBalken({
  daten,
}: {
  daten: { name: string; kosten: number; anteil: number }[];
}) {
  if (daten.length === 0) return null;
  const max = Math.max(...daten.map((d) => d.kosten));
  return (
    <ul className="space-y-2">
      {daten.map((d, i) => (
        <li key={d.name}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-slate-700">{d.name}</span>
            <span className="shrink-0 tabellenzahl font-medium text-slate-900">
              {euroAuto(d.kosten)}
              <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                {prozent(d.anteil * 100, 0)}
              </span>
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? (d.kosten / max) * 100 : 0}%`,
                backgroundColor: i === 0 ? BLAU : BLAU_HELL,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tornado
// ---------------------------------------------------------------------------

export interface TornadoZeile {
  label: string;
  beschreibung: string;
  niedrig: number;
  hoch: number;
  basis: number;
}

export function Tornado({ zeilen }: { zeilen: TornadoZeile[] }) {
  if (zeilen.length === 0) return null;
  const basis = zeilen[0].basis;
  const daten = zeilen.map((z) => ({
    ...z,
    entlastung: Math.min(z.niedrig, z.hoch) - basis,
    belastung: Math.max(z.niedrig, z.hoch) - basis,
  }));
  const spanne = Math.max(...daten.map((d) => Math.max(Math.abs(d.entlastung), Math.abs(d.belastung))));

  return (
    <div style={{ height: Math.max(160, zeilen.length * 42 + 40) }} className="w-full">
      <ResponsiveContainer>
        <BarChart
          data={daten}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 18 }}
          barCategoryGap="26%"
          stackOffset="sign"
        >
          <XAxis
            type="number"
            domain={[-spanne * 1.15, spanne * 1.15]}
            tick={ACHSE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => zahl(v, 2)}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={ACHSE}
            axisLine={false}
            tickLine={false}
            width={112}
          />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const z = payload[0].payload as (typeof daten)[number];
              return (
                <Tooltipkasten
                  titel={z.label}
                  zeilen={[
                    { text: z.beschreibung, wert: '' },
                    { text: 'entlastend', wert: euroAuto(basis + z.entlastung) },
                    { text: 'belastend', wert: euroAuto(basis + z.belastung) },
                    { text: 'Spanne', wert: euroAuto(z.belastung - z.entlastung) },
                  ].filter((r) => r.wert !== '' || r.text === z.beschreibung)}
                />
              );
            }}
          />
          <Bar dataKey="entlastung" stackId="t" fill={BLAU} radius={[4, 0, 0, 4]} isAnimationActive={false} />
          <Bar dataKey="belastung" stackId="t" fill={ROT} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 flex items-center justify-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLAU }} /> entlastend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ROT }} /> belastend
        </span>
        <span>Basis {euroAuto(basis)}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vergleich: gestapelte Kostenstruktur
// ---------------------------------------------------------------------------

export const VERGLEICH_SEGMENTE = [
  { schluessel: 'rohware', label: 'Rohware' },
  { schluessel: 'verpackung', label: 'Verpackung' },
  { schluessel: 'fertigung', label: 'Fertigung' },
  { schluessel: 'materialgemein', label: 'Materialgemeinkosten' },
  { schluessel: 'verwaltungVertrieb', label: 'Verwaltung & Vertrieb' },
  { schluessel: 'sonstige', label: 'QS, F&E, Logistik' },
] as const;

export type VergleichZeile = { name: string } & Record<
  (typeof VERGLEICH_SEGMENTE)[number]['schluessel'],
  number
>;

export function VergleichStapel({ daten }: { daten: VergleichZeile[] }) {
  if (daten.length === 0) return null;
  return (
    <div style={{ height: Math.max(220, daten.length * 64 + 60) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={daten} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 8 }} barCategoryGap="30%">
          <XAxis
            type="number"
            tick={ACHSE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => zahl(v, 2)}
          />
          <YAxis type="category" dataKey="name" tick={ACHSE} axisLine={false} tickLine={false} width={104} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <Tooltipkasten
                  titel={String(label)}
                  zeilen={[
                    ...payload.map((p) => ({
                      text: String(p.name),
                      wert: euroAuto(Number(p.value)),
                    })),
                    {
                      text: 'Vollkosten',
                      wert: euro(payload.reduce((s, p) => s + Number(p.value ?? 0), 0)),
                    },
                  ]}
                />
              );
            }}
          />
          {VERGLEICH_SEGMENTE.map((s, i) => (
            <Bar
              key={s.schluessel}
              dataKey={s.schluessel}
              name={s.label}
              stackId="v"
              fill={KATEGORIAL[i]}
              stroke={FLAECHE}
              strokeWidth={2}
              isAnimationActive={false}
              radius={i === VERGLEICH_SEGMENTE.length - 1 ? [0, 4, 4, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VergleichLegende() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
      {VERGLEICH_SEGMENTE.map((s, i) => (
        <li key={s.schluessel} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: KATEGORIAL[i] }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
