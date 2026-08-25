import Anthropic from '@anthropic-ai/sdk';
import { normalisiereExtraktion, type ExtraktionsErgebnis } from '../costing/extraktion';
import { EXTRAKTIONS_SCHEMA, NUTZER_PROMPT, SYSTEM_PROMPT } from './schema';
import type { ProductPhoto } from '../costing/types';

/**
 * Bilderkennung ueber die Anthropic Messages API.
 *
 * Die Analyse laeuft im Browser. Zwei Betriebsarten:
 *  - eigener API-Schluessel, direkt gegen api.anthropic.com
 *  - eigener Proxy (empfohlen fuer den produktiven Einsatz), damit der
 *    Schluessel den Server nicht verlaesst
 */

export type Effort = 'low' | 'medium' | 'high';

export interface VisionEinstellungen {
  apiKey: string;
  /** Basis-URL eines eigenen Proxys. Leer = direkt gegen die Anthropic-API. */
  proxyUrl: string;
  model: string;
  effort: Effort;
}

export const STANDARD_MODELL = 'claude-opus-5';

export const MODELL_AUSWAHL = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', hinweis: 'höchste Lesegenauigkeit' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', hinweis: 'schneller und günstiger' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hinweis: 'schnellste Variante' },
];

export const STANDARD_EINSTELLUNGEN: VisionEinstellungen = {
  apiKey: '',
  proxyUrl: '',
  model: STANDARD_MODELL,
  effort: 'medium',
};

export function istKonfiguriert(e: VisionEinstellungen): boolean {
  return Boolean(e.apiKey.trim() || e.proxyUrl.trim());
}

export class AnalyseFehler extends Error {
  constructor(
    message: string,
    readonly ursache?: unknown,
  ) {
    super(message);
    this.name = 'AnalyseFehler';
  }
}

interface BildTeil {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string;
}

/** Zerlegt eine Data-URL in Medientyp und Base64-Nutzdaten. */
function zerlegeDataUrl(dataUrl: string): BildTeil | null {
  const treffer = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!treffer) return null;
  return { mediaType: treffer[1] as BildTeil['mediaType'], data: treffer[2] };
}

const ROLLEN_TEXT: Record<ProductPhoto['rolle'], string> = {
  vorderseite: 'Foto 1 – Vorderseite der Verpackung',
  zutaten: 'Foto – Zutatenliste',
  naehrwerte: 'Foto – Nährwerttabelle',
  rueckseite: 'Foto – Verpackungsrückseite bzw. Boden',
};

function erzeugeClient(e: VisionEinstellungen): Anthropic {
  const basis = e.proxyUrl.trim();
  return new Anthropic({
    apiKey: e.apiKey.trim() || 'proxy',
    baseURL: basis || undefined,
    // Die App laeuft bewusst ohne eigenen Server. Der Nutzer entscheidet in den
    // Einstellungen, ob er seinen Schluessel lokal hinterlegt oder einen Proxy
    // vorschaltet; der Hinweis dazu steht im Einstellungsdialog.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });
}

/** Analysiert die Fotos eines Produkts und liefert die strukturierte Extraktion. */
export async function analysiereFotos(
  fotos: ProductPhoto[],
  einstellungen: VisionEinstellungen,
  signal?: AbortSignal,
): Promise<ExtraktionsErgebnis> {
  if (fotos.length === 0) throw new AnalyseFehler('Es sind keine Fotos erfasst.');
  if (!istKonfiguriert(einstellungen)) {
    throw new AnalyseFehler(
      'Es ist kein API-Schlüssel und kein Proxy hinterlegt. Bitte in den Einstellungen ergänzen.',
    );
  }

  const inhalt: Anthropic.ContentBlockParam[] = [];
  for (const foto of fotos) {
    const bild = zerlegeDataUrl(foto.dataUrl);
    if (!bild) continue;
    inhalt.push({ type: 'text', text: ROLLEN_TEXT[foto.rolle] });
    inhalt.push({
      type: 'image',
      source: { type: 'base64', media_type: bild.mediaType, data: bild.data },
    });
  }
  if (inhalt.length === 0) throw new AnalyseFehler('Die Fotos konnten nicht gelesen werden.');
  inhalt.push({ type: 'text', text: NUTZER_PROMPT });

  const client = erzeugeClient(einstellungen);

  let antwort: Anthropic.Message;
  try {
    antwort = await client.messages.create(
      {
        model: einstellungen.model || STANDARD_MODELL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: inhalt }],
        output_config: {
          format: { type: 'json_schema', schema: EXTRAKTIONS_SCHEMA },
          effort: einstellungen.effort,
        },
      },
      { signal },
    );
  } catch (fehler) {
    throw new AnalyseFehler(lesbareFehlermeldung(fehler), fehler);
  }

  if (antwort.stop_reason === 'refusal') {
    throw new AnalyseFehler('Die Analyse wurde vom Modell abgelehnt. Bitte andere Fotos verwenden.');
  }

  const roh = leseJson(antwort);
  if (roh === null) {
    throw new AnalyseFehler('Die Antwort des Modells war nicht auswertbar.');
  }
  return normalisiereExtraktion(roh);
}

/** Holt das JSON aus der Antwort – bevorzugt aus dem geparsten Feld. */
function leseJson(antwort: Anthropic.Message): unknown {
  const geparst = (antwort as { parsed_output?: unknown }).parsed_output;
  if (geparst && typeof geparst === 'object') return geparst;

  const text = antwort.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) return null;

  const bereinigt = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(bereinigt);
  } catch {
    // Notfalls das erste vollstaendige JSON-Objekt aus dem Text schneiden.
    const von = bereinigt.indexOf('{');
    const bis = bereinigt.lastIndexOf('}');
    if (von >= 0 && bis > von) {
      try {
        return JSON.parse(bereinigt.slice(von, bis + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function lesbareFehlermeldung(fehler: unknown): string {
  if (fehler instanceof Anthropic.APIError) {
    if (fehler.status === 401) return 'Der API-Schlüssel wurde abgelehnt (401). Bitte prüfen.';
    if (fehler.status === 429) return 'Das Anfragelimit ist erreicht (429). Bitte kurz warten.';
    if (fehler.status === 400) return `Die Anfrage wurde abgelehnt (400): ${fehler.message}`;
    if (fehler.status && fehler.status >= 500) return 'Die API ist vorübergehend nicht erreichbar.';
    return fehler.message;
  }
  if (fehler instanceof Error) {
    if (fehler.name === 'AbortError') return 'Die Analyse wurde abgebrochen.';
    return fehler.message;
  }
  return 'Unbekannter Fehler bei der Analyse.';
}
