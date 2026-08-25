import { useState } from 'react';
import { useStore } from '../state/store';
import {
  Auswahl,
  Blatt,
  GeschaetztFeld,
  Hinweisleiste,
  Karte,
  KonfidenzBadge,
  Knopf,
  ZahlFeld,
} from '../components/basis';
import {
  NAEHRWERT_EINHEIT,
  NAEHRWERT_FELDER,
  NAEHRWERT_LABEL,
  NULL_NAEHRWERTE,
  PRUEF_SCHWELLE,
  QUALITAET_LABEL,
  STAFFEL_LABEL,
  VERPACKUNGSART_LABEL,
  geschaetzt,
  gramm,
  ingredientName,
  prozent,
  rechneProduktNeu,
  schaetzeVerpackung,
  zahl,
} from '../lib/costing';
import type {
  Mengenstaffel,
  Naehrwerte,
  Product,
  Qualitaetsstufe,
  Verpackungsart,
} from '../lib/costing';
import { INGREDIENTS } from '../lib/data/ingredients';
import { KATEGORIEN } from '../lib/data/kategorien';

/**
 * Schritt "Prüfen": alles, was die Bilderkennung geliefert hat, wird hier
 * bestaetigt oder korrigiert. Jede Bearbeitung setzt die Quelle auf "nutzer" –
 * damit wird aus einer gestrichelten eine durchgezogene Umrandung.
 */
export function PruefenSchritt({
  produkt,
  onAendern,
  onWeiter,
}: {
  produkt: Product;
  onAendern: (f: (p: Product) => Product) => void;
  onWeiter: () => void;
}) {
  const rezepturNeuRechnen = useStore((s) => s.rezepturNeuRechnen);

  const zuPruefen = [
    produkt.name,
    produkt.marke,
    produkt.fuellmengeG,
    produkt.zutatenText,
    produkt.verpackungsart,
    ...(produkt.naehrwerte ? [produkt.naehrwerte] : []),
  ].filter((f) => f.quelle !== 'nutzer' && f.konfidenz < PRUEF_SCHWELLE).length;

  return (
    <div className="space-y-4">
      {zuPruefen > 0 && (
        <Hinweisleiste art="warnung">
          {zuPruefen === 1
            ? 'Ein Feld wurde unsicher erkannt und ist gelb markiert.'
            : `${zuPruefen} Felder wurden unsicher erkannt und sind gelb markiert.`}{' '}
          Bitte prüfen – jede Korrektur verbessert die Kalkulation.
        </Hinweisleiste>
      )}

      <Karte titel="Stammdaten">
        <div className="grid gap-3 sm:grid-cols-2">
          <GeschaetztFeld
            label="Produktname"
            wert={produkt.name}
            onChange={(v) => onAendern((p) => ({ ...p, name: geschaetzt(String(v), 1, 'nutzer') }))}
          />
          <GeschaetztFeld
            label="Marke"
            wert={produkt.marke}
            onChange={(v) => onAendern((p) => ({ ...p, marke: geschaetzt(String(v), 1, 'nutzer') }))}
          />
          <GeschaetztFeld
            label="Hersteller / Abpacker"
            wert={produkt.hersteller}
            onChange={(v) =>
              onAendern((p) => ({ ...p, hersteller: geschaetzt(String(v), 1, 'nutzer') }))
            }
          />
          <GeschaetztFeld
            label="Herkunftsland"
            wert={produkt.herkunftsland}
            onChange={(v) =>
              onAendern((p) => ({ ...p, herkunftsland: geschaetzt(String(v), 1, 'nutzer') }))
            }
          />
          <GeschaetztFeld
            label="Füllmenge"
            wert={produkt.fuellmengeG}
            einheit="g / ml"
            typ="zahl"
            onChange={(v) =>
              onAendern((p) =>
                rechneProduktNeu({ ...p, fuellmengeG: geschaetzt(Number(v), 1, 'nutzer') }),
              )
            }
          />
          <GeschaetztFeld
            label="EAN / GTIN"
            wert={produkt.ean ?? geschaetzt('', 0, 'nutzer')}
            onChange={(v) => onAendern((p) => ({ ...p, ean: geschaetzt(String(v), 1, 'nutzer') }))}
          />
          <Auswahl
            label="Produktkategorie"
            wert={produkt.kategorie.wert}
            optionen={KATEGORIEN.map((k) => ({ wert: k.id, text: k.label }))}
            onChange={(v) =>
              onAendern((p) =>
                rechneProduktNeu({
                  ...p,
                  kategorie: geschaetzt(v, 1, 'nutzer'),
                  profileId: `cp_${v}`,
                  recipe: {
                    ...p.recipe,
                    verlustQuote:
                      KATEGORIEN.find((k) => k.id === v)?.verlustQuote ?? p.recipe.verlustQuote,
                  },
                }),
              )
            }
          />
          <Auswahl
            label="Beschaffungsmenge (Preisstaffel)"
            wert={produkt.staffel}
            optionen={(['kleinmenge', 'kontrakt', 'grosskontrakt'] as Mengenstaffel[]).map((s) => ({
              wert: s,
              text: STAFFEL_LABEL[s],
            }))}
            onChange={(v) => onAendern((p) => ({ ...p, staffel: v }))}
          />
          <GeschaetztFeld
            label="Regalpreis (brutto)"
            wert={produkt.regalpreis ?? geschaetzt(0, 0, 'nutzer')}
            einheit="€"
            typ="zahl"
            nachkomma={2}
            hinweis="Ermöglicht die Rückwärtskalkulation auf die Herstellermarge."
            onChange={(v) =>
              onAendern((p) => ({ ...p, regalpreis: geschaetzt(Number(v), 1, 'nutzer') }))
            }
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Händler</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-marke-500"
              value={produkt.haendler}
              placeholder="z. B. Vollsortimenter, Discount"
              onChange={(e) => onAendern((p) => ({ ...p, haendler: e.target.value }))}
            />
          </label>
        </div>

        {produkt.siegel.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {produkt.siegel.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {s.name}
                <KonfidenzBadge wert={s.konfidenz} klein />
              </span>
            ))}
          </div>
        )}
      </Karte>

      <Karte
        titel="Zutatenliste"
        aktion={
          <button
            onClick={() => rezepturNeuRechnen(produkt.id)}
            className="text-xs text-marke-700 hover:underline"
          >
            Rezeptur neu berechnen
          </button>
        }
      >
        <GeschaetztFeld
          label="Wortlaut vom Etikett"
          wert={produkt.zutatenText}
          platzhalter="Haferflocken 58 %, Zucker, Sonnenblumenöl, …"
          onChange={(v) =>
            onAendern((p) =>
              rechneProduktNeu({ ...p, zutatenText: geschaetzt(String(v), 1, 'nutzer') }),
            )
          }
        />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Reihenfolge und Prozentangaben bitte unverändert übernehmen – daraus entstehen die harten
          Schranken der Rezepturschätzung.
        </p>
        {produkt.recipe.lines.length > 0 && (
          <p className="mt-2 text-[12px] text-slate-600">
            {produkt.recipe.lines.length} Zutaten erkannt,{' '}
            {produkt.recipe.lines.filter((l) => l.quid !== null).length} davon mit QUID-Angabe,{' '}
            {produkt.recipe.lines.filter((l) => !l.ingredientId).length} ohne Rohstoffzuordnung.
          </p>
        )}
      </Karte>

      <NaehrwertKarte produkt={produkt} onAendern={onAendern} />
      <ZutatZuordnung produkt={produkt} />
      <VerpackungKarte produkt={produkt} onAendern={onAendern} />

      <Knopf variante="primaer" gross className="w-full" onClick={onWeiter}>
        Kalkulation ansehen
      </Knopf>
    </div>
  );
}

function NaehrwertKarte({
  produkt,
  onAendern,
}: {
  produkt: Product;
  onAendern: (f: (p: Product) => Product) => void;
}) {
  const werte = produkt.naehrwerte?.wert ?? NULL_NAEHRWERTE;
  const konfidenz = produkt.naehrwerte?.konfidenz ?? 0;
  const fit = produkt.recipe.fit;

  const setzen = (feld: keyof Naehrwerte, v: number) => {
    onAendern((p) =>
      rechneProduktNeu({
        ...p,
        naehrwerte: geschaetzt({ ...(p.naehrwerte?.wert ?? NULL_NAEHRWERTE), [feld]: v }, 1, 'nutzer'),
      }),
    );
  };

  return (
    <Karte
      titel="Nährwerte je 100 g"
      aktion={produkt.naehrwerte ? <KonfidenzBadge wert={konfidenz} /> : undefined}
    >
      {!produkt.naehrwerte && (
        <p className="mb-3 text-[12px] text-slate-500">
          Noch keine Nährwerttabelle erfasst. Ohne sie beruht die Rezepturschätzung allein auf
          Reihenfolge, QUID-Angaben und Kategoriewissen.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {NAEHRWERT_FELDER.map((feld) => (
          <ZahlFeld
            key={feld}
            label={NAEHRWERT_LABEL[feld]}
            wert={werte[feld]}
            einheit={NAEHRWERT_EINHEIT[feld]}
            nachkomma={feld === 'energieKj' ? 0 : 1}
            onChange={(v) => setzen(feld, v)}
          />
        ))}
      </div>

      {fit?.deklariert && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Rückrechnung aus der geschätzten Rezeptur
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2 font-medium">Nährwert</th>
                <th className="py-1 pr-2 text-right font-medium">deklariert</th>
                <th className="py-1 pr-2 text-right font-medium">berechnet</th>
                <th className="py-1 text-right font-medium">Abweichung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {NAEHRWERT_FELDER.map((feld) => {
                const abw = fit.abweichungProzent[feld];
                const gross = abw !== undefined && Math.abs(abw) > 15;
                return (
                  <tr key={feld}>
                    <td className="py-1 pr-2 text-slate-700">{NAEHRWERT_LABEL[feld]}</td>
                    <td className="py-1 pr-2 text-right tabellenzahl text-slate-600">
                      {zahl(fit.deklariert![feld], feld === 'energieKj' ? 0 : 1)}
                    </td>
                    <td className="py-1 pr-2 text-right tabellenzahl text-slate-800">
                      {zahl(fit.berechnet[feld], feld === 'energieKj' ? 0 : 1)}
                    </td>
                    <td
                      className={`py-1 text-right tabellenzahl ${
                        gross ? 'font-medium text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {abw === undefined ? '—' : `${abw > 0 ? '+' : ''}${zahl(abw, 1)} %`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            Größte Restabweichung {prozent(fit.maxAbweichungProzent)} · Rezepturgüte{' '}
            {prozent(fit.guete * 100, 0)}
            {fit.maxAbweichungProzent > 15 &&
              ' · über 15 % – bitte Zutatenliste und Nährwerte gegenprüfen.'}
          </p>
        </div>
      )}
    </Karte>
  );
}

function ZutatZuordnung({ produkt }: { produkt: Product }) {
  const zuordnen = useStore((s) => s.zutatZuordnen);
  const aendereProdukt = useStore((s) => s.aendereProdukt);
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState('');

  const ohne = produkt.recipe.lines.filter((l) => !l.ingredientId);
  if (produkt.recipe.lines.length === 0) return null;

  const gefiltert = INGREDIENTS.filter((i) =>
    suche.trim()
      ? [i.name, ...i.synonyme].some((s) => s.toLowerCase().includes(suche.toLowerCase()))
      : true,
  ).slice(0, 40);

  return (
    <Karte titel="Rohstoffzuordnung">
      {ohne.length > 0 && (
        <div className="mb-3">
          <Hinweisleiste art="warnung">
            {ohne.length === 1
              ? 'Eine Zutat konnte keinem Rohstoff zugeordnet werden.'
              : `${ohne.length} Zutaten konnten keinem Rohstoff zugeordnet werden.`}{' '}
            Ohne Zuordnung fehlen Nährwertprofil und Einkaufspreis.
          </Hinweisleiste>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {produkt.recipe.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-slate-800">{l.etikettName}</span>
              <span className={`block text-[11px] ${l.ingredientId ? 'text-slate-500' : 'text-amber-700'}`}>
                {ingredientName(l.ingredientId)}
              </span>
            </span>
            <select
              className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
              value={l.qualitaet}
              onChange={(e) =>
                aendereProdukt(produkt.id, (p) => ({
                  ...p,
                  recipe: {
                    ...p.recipe,
                    lines: p.recipe.lines.map((x) =>
                      x.id === l.id ? { ...x, qualitaet: e.target.value as Qualitaetsstufe } : x,
                    ),
                  },
                }))
              }
              aria-label={`Qualitätsstufe für ${l.etikettName}`}
            >
              {(['standard', 'bio', 'zertifiziert'] as Qualitaetsstufe[]).map((q) => (
                <option key={q} value={q}>
                  {QUALITAET_LABEL[q]}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setOffen(l.id);
                setSuche('');
              }}
              className="shrink-0 text-[11px] text-marke-700 hover:underline"
            >
              ändern
            </button>
          </li>
        ))}
      </ul>

      <Blatt offen={offen !== null} titel="Rohstoff zuordnen" onSchliessen={() => setOffen(null)}>
        <input
          autoFocus
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marke-500"
          placeholder="Rohstoff suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <ul className="divide-y divide-slate-100">
          <li>
            <button
              className="w-full py-2 text-left text-[13px] text-slate-500"
              onClick={() => {
                if (offen) zuordnen(produkt.id, offen, null);
                setOffen(null);
              }}
            >
              keine Zuordnung
            </button>
          </li>
          {gefiltert.map((i) => (
            <li key={i.id}>
              <button
                className="w-full py-2 text-left text-[13px] text-slate-800 hover:text-marke-700"
                onClick={() => {
                  if (offen) zuordnen(produkt.id, offen, i.id);
                  setOffen(null);
                }}
              >
                {i.name}
                <span className="ml-2 text-[11px] text-slate-400">
                  {zahl(i.naehrwerte.energieKj, 0)} kJ · {zahl(i.basispreisJeKg, 2)} €/kg
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Blatt>
    </Karte>
  );
}

function VerpackungKarte({
  produkt,
  onAendern,
}: {
  produkt: Product;
  onAendern: (f: (p: Product) => Product) => void;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <Karte
      titel="Verpackung"
      aktion={
        <button onClick={() => setOffen(true)} className="text-xs text-marke-700 hover:underline">
          Details bearbeiten
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Auswahl
          label="Verpackungsart"
          wert={produkt.verpackungsart.wert}
          optionen={(Object.keys(VERPACKUNGSART_LABEL) as Verpackungsart[]).map((a) => ({
            wert: a,
            text: VERPACKUNGSART_LABEL[a],
          }))}
          onChange={(v) =>
            onAendern((p) => ({
              ...p,
              verpackungsart: geschaetzt(v, 1, 'nutzer'),
              packaging: schaetzeVerpackung(v, p.fuellmengeG.wert, p.verpackungsMerkmale),
            }))
          }
        />
        <ZahlFeld
          label="Produktionsverlust"
          wert={produkt.recipe.verlustQuote * 100}
          einheit="%"
          nachkomma={1}
          hinweis="Schwund, Back- und Trocknungsverlust. Erhöht die Einsatzmenge."
          onChange={(v) =>
            onAendern((p) => ({
              ...p,
              recipe: { ...p.recipe, verlustQuote: Math.max(0, Math.min(50, v)) / 100 },
            }))
          }
        />
      </div>

      <ul className="mt-3 divide-y divide-slate-100 text-[12px]">
        {produkt.packaging.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-slate-700">
              <span className="mr-1.5 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">
                {{ primaer: 'P', sekundaer: 'S', tertiaer: 'T' }[s.ebene]}
              </span>
              {s.bezeichnung}
            </span>
            <span className="shrink-0 tabellenzahl text-slate-500">
              {gramm(s.gewichtG, 0)} · {s.vePro > 1 ? `${zahl(s.vePro, 0)} VE` : '1 VE'}
            </span>
          </li>
        ))}
      </ul>

      <Blatt offen={offen} titel="Verpackung bearbeiten" onSchliessen={() => setOffen(false)}>
        <div className="space-y-5">
          {produkt.packaging.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-[13px] font-medium text-slate-800">{s.bezeichnung}</p>
              <div className="grid grid-cols-2 gap-3">
                <ZahlFeld
                  label="Gewicht je Stück"
                  wert={s.gewichtG}
                  einheit="g"
                  nachkomma={1}
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, gewichtG: v, geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
                <ZahlFeld
                  label="Materialpreis"
                  wert={s.materialPreisJeKg}
                  einheit="€/kg"
                  nachkomma={3}
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, materialPreisJeKg: v, geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
                <ZahlFeld
                  label="Druckfarben"
                  wert={s.druckfarben}
                  nachkomma={0}
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, druckfarben: Math.max(0, Math.round(v)), geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
                <ZahlFeld
                  label="Konfektion je Stück"
                  wert={s.zusatzKostenJeStueck}
                  einheit="€"
                  nachkomma={3}
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, zusatzKostenJeStueck: v, geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
                <ZahlFeld
                  label="Verkaufseinheiten je Packmittel"
                  wert={s.vePro}
                  nachkomma={0}
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, vePro: Math.max(1, Math.round(v)), geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
                <ZahlFeld
                  label="Lizenzentgelt"
                  wert={s.lizenzJeKg}
                  einheit="€/kg"
                  nachkomma={2}
                  hinweis="Duales System, nur Verkaufsverpackung"
                  onChange={(v) =>
                    onAendern((p) => ({
                      ...p,
                      packaging: p.packaging.map((x) =>
                        x.id === s.id ? { ...x, lizenzJeKg: v, geschaetzt: false } : x,
                      ),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          <Knopf
            onClick={() =>
              onAendern((p) => ({
                ...p,
                packaging: schaetzeVerpackung(
                  p.verpackungsart.wert,
                  p.fuellmengeG.wert,
                  p.verpackungsMerkmale,
                ),
              }))
            }
          >
            Auf Schätzwerte zurücksetzen
          </Knopf>
        </div>
      </Blatt>
    </Karte>
  );
}
