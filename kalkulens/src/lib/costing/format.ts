/** Deutsche Zahlen- und Waehrungsformatierung (1.234,56 €). */

const euroFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euroCentFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function euro(v: number | null | undefined, cent = false): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return cent ? euroCentFormat.format(v) : euroFormat.format(v);
}

/** Waehlt automatisch vier Nachkommastellen, wenn der Betrag sonst als 0,00 erschiene. */
export function euroAuto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return euro(v, Math.abs(v) > 0 && Math.abs(v) < 0.01);
}

export function zahl(v: number | null | undefined, nachkomma = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: nachkomma,
    maximumFractionDigits: nachkomma,
  }).format(v);
}

export function prozent(v: number | null | undefined, nachkomma = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${zahl(v, nachkomma)} %`;
}

/** Prozentwert aus einem Anteil 0..1. */
export function anteilProzent(v: number, nachkomma = 1): string {
  return prozent(v * 100, nachkomma);
}

export function gramm(v: number | null | undefined, nachkomma = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${zahl(v, nachkomma)} g`;
}

export function datum(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function datumZeit(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Liest eine deutsch formatierte Zahl aus einem Eingabefeld. */
export function parseZahl(text: string): number | null {
  const t = text.trim().replace(/\s|€|%/g, '').replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
