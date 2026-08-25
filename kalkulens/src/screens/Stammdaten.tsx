import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Auswahl, Karte, Knopf, ZahlFeld } from '../components/basis';
import {
  GRUPPE_LABEL,
  QUALITAET_LABEL,
  STAFFEL_LABEL,
  datum,
  euro,
  zahl,
} from '../lib/costing';
import type { IngredientPrice, Mengenstaffel, Qualitaetsstufe } from '../lib/costing';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../lib/data/ingredients';
import { KATEGORIE_BY_ID } from '../lib/data/kategorien';

type Bereich = 'preise' | 'profile';

/** Stammdaten: Rohstoffpreisdatenbank und Kalkulationsprofile. */
export function StammdatenScreen() {
  const [bereich, setBereich] = useState<Bereich>('preise');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
        {(
          [
            ['preise', 'Rohstoffpreise'],
            ['profile', 'Kalkulationsprofile'],
          ] as [Bereich, string][]
        ).map(([id, text]) => (
          <button
            key={id}
            onClick={() => setBereich(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              bereich === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {bereich === 'preise' ? <PreisPflege /> : <ProfilPflege />}
    </div>
  );
}

function PreisPflege() {
  const preise = useStore((s) => s.preise);
  const preisAendern = useStore((s) => s.preisAendern);
  const preiseZuruecksetzen = useStore((s) => s.preiseZuruecksetzen);

  const [suche, setSuche] = useState('');
  const [qualitaet, setQualitaet] = useState<Qualitaetsstufe>('standard');
  const [staffel, setStaffel] = useState<Mengenstaffel>('kontrakt');
  const [gruppe, setGruppe] = useState<string>('alle');

  const eintraege = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return preise
      .filter((p) => p.qualitaet === qualitaet)
      .map((p) => ({ preis: p, zutat: INGREDIENT_BY_ID.get(p.ingredientId) }))
      .filter((e) => !!e.zutat)
      .filter((e) => (gruppe === 'alle' ? true : e.zutat!.gruppe === gruppe))
      .filter((e) =>
        s ? [e.zutat!.name, ...e.zutat!.synonyme].some((n) => n.toLowerCase().includes(s)) : true,
      )
      .sort((a, b) => a.zutat!.name.localeCompare(b.zutat!.name, 'de'));
  }, [preise, qualitaet, gruppe, suche]);

  const gruppen = useMemo(() => [...new Set(INGREDIENTS.map((i) => i.gruppe))], []);

  return (
    <div className="space-y-4">
      <Karte
        titel="Rohstoffpreisdatenbank"
        aktion={
          <button
            onClick={() => {
              if (confirm('Alle Preise auf die Startwerte zurücksetzen?')) preiseZuruecksetzen();
            }}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            zurücksetzen
          </button>
        }
      >
        <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
          Version 1 pflegt die Preise manuell – es gibt bewusst keine Börsenanbindung. Jeder Satz
          trägt Gültigkeitsdatum und Quelle. Änderungen wirken sofort auf alle Kalkulationen.
        </p>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marke-500"
          placeholder="Rohstoff suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            value={qualitaet}
            onChange={(e) => setQualitaet(e.target.value as Qualitaetsstufe)}
            aria-label="Qualitätsstufe"
          >
            {(['standard', 'bio', 'zertifiziert'] as Qualitaetsstufe[]).map((q) => (
              <option key={q} value={q}>
                {QUALITAET_LABEL[q]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            value={staffel}
            onChange={(e) => setStaffel(e.target.value as Mengenstaffel)}
            aria-label="Mengenstaffel"
          >
            {(['kleinmenge', 'kontrakt', 'grosskontrakt'] as Mengenstaffel[]).map((s) => (
              <option key={s} value={s}>
                {STAFFEL_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            value={gruppe}
            onChange={(e) => setGruppe(e.target.value)}
            aria-label="Warengruppe"
          >
            <option value="alle">Alle Gruppen</option>
            {gruppen.map((g) => (
              <option key={g} value={g}>
                {GRUPPE_LABEL[g]}
              </option>
            ))}
          </select>
        </div>
      </Karte>

      <Karte titel={`${eintraege.length} Rohstoffe`} dicht>
        <ul className="divide-y divide-slate-100">
          {eintraege.map(({ preis, zutat }) => (
            <PreisZeile
              key={`${preis.ingredientId}-${preis.qualitaet}`}
              preis={preis}
              name={zutat!.name}
              gruppe={GRUPPE_LABEL[zutat!.gruppe]}
              staffel={staffel}
              onAendern={preisAendern}
            />
          ))}
        </ul>
      </Karte>
    </div>
  );
}

function PreisZeile({
  preis,
  name,
  gruppe,
  staffel,
  onAendern,
}: {
  preis: IngredientPrice;
  name: string;
  gruppe: string;
  staffel: Mengenstaffel;
  onAendern: (p: IngredientPrice) => void;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <li className="px-4 py-2.5">
      <button onClick={() => setOffen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-slate-800">{name}</span>
          <span className="block text-[11px] text-slate-400">
            {gruppe} · gültig ab {datum(preis.gueltigAb)} · {preis.quelle}
          </span>
        </span>
        <span className="shrink-0 tabellenzahl text-[13px] font-medium text-slate-900">
          {zahl(preis.preisJeKg[staffel], 3)} €/kg
        </span>
        <span className="text-slate-300">{offen ? '⌃' : '⌄'}</span>
      </button>
      {offen && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['kleinmenge', 'kontrakt', 'grosskontrakt'] as Mengenstaffel[]).map((s) => (
            <ZahlFeld
              key={s}
              label={STAFFEL_LABEL[s]}
              wert={preis.preisJeKg[s]}
              einheit="€/kg"
              nachkomma={3}
              onChange={(v) =>
                onAendern({
                  ...preis,
                  preisJeKg: { ...preis.preisJeKg, [s]: Math.max(0, v) },
                  gueltigAb: new Date().toISOString().slice(0, 10),
                  quelle: 'manuell gepflegt',
                })
              }
            />
          ))}
        </div>
      )}
    </li>
  );
}

function ProfilPflege() {
  const profile = useStore((s) => s.profile);
  const profilAendern = useStore((s) => s.profilAendern);
  const profilZuruecksetzen = useStore((s) => s.profilZuruecksetzen);
  const [gewaehlt, setGewaehlt] = useState(profile[0]?.id ?? '');

  const profil = profile.find((p) => p.id === gewaehlt) ?? profile[0];
  if (!profil) return null;

  const setzen = (teil: Partial<typeof profil>) => profilAendern({ ...profil, ...teil });

  return (
    <div className="space-y-4">
      <Karte
        titel="Kalkulationsprofil"
        aktion={
          <button
            onClick={() => {
              if (confirm('Dieses Profil auf die Standardsätze zurücksetzen?'))
                profilZuruecksetzen(profil.id);
            }}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            zurücksetzen
          </button>
        }
      >
        <Auswahl
          label="Profil je Produktkategorie"
          wert={gewaehlt}
          optionen={profile.map((p) => ({
            wert: p.id,
            text: p.kategorie ? (KATEGORIE_BY_ID.get(p.kategorie)?.label ?? p.name) : p.name,
          }))}
          onChange={setGewaehlt}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          Die Sätze gelten für alle Produkte dieser Kategorie. Sie sind Standardwerte der
          Lebensmittelindustrie – für eine konkrete Verhandlung lohnt es sich, sie an das
          Herstellerprofil anzupassen.
        </p>
      </Karte>

      <Karte titel="Material und Fertigung">
        <div className="grid gap-3 sm:grid-cols-2">
          <ZahlFeld
            label="Materialgemeinkosten"
            wert={profil.materialGemeinkostenProzent}
            einheit="%"
            nachkomma={1}
            hinweis="Einkauf, Wareneingang, Rohstofflager"
            onChange={(v) => setzen({ materialGemeinkostenProzent: v })}
          />
          <ZahlFeld
            label="Personalkosten"
            wert={profil.personalkostenJeStunde}
            einheit="€/h"
            nachkomma={2}
            onChange={(v) => setzen({ personalkostenJeStunde: v })}
          />
          <ZahlFeld
            label="Personen je Linie"
            wert={profil.personenJeLinie}
            nachkomma={0}
            onChange={(v) => setzen({ personenJeLinie: Math.max(0, v) })}
          />
          <ZahlFeld
            label="Ausbringung"
            wert={profil.ausbringungJeStunde}
            einheit="VE/h"
            nachkomma={0}
            onChange={(v) => setzen({ ausbringungJeStunde: Math.max(1, v) })}
          />
          <ZahlFeld
            label="Maschinenstundensatz"
            wert={profil.maschinenstundensatz}
            einheit="€/h"
            nachkomma={2}
            onChange={(v) => setzen({ maschinenstundensatz: v })}
          />
          <ZahlFeld
            label="Energiekosten"
            wert={profil.energieJeStunde}
            einheit="€/h"
            nachkomma={2}
            onChange={(v) => setzen({ energieJeStunde: v })}
          />
          <ZahlFeld
            label="Rüstkosten je Los"
            wert={profil.ruestkostenJeLos}
            einheit="€"
            nachkomma={2}
            onChange={(v) => setzen({ ruestkostenJeLos: v })}
          />
          <ZahlFeld
            label="Losgröße"
            wert={profil.losgroesseVe}
            einheit="VE"
            nachkomma={0}
            hinweis="Rüstkosten werden degressiv darauf verteilt."
            onChange={(v) => setzen({ losgroesseVe: Math.max(1, v) })}
          />
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] tabellenzahl text-slate-600">
          Fertigungseinzelkosten{' '}
          {euro((profil.personalkostenJeStunde * profil.personenJeLinie) / Math.max(1, profil.ausbringungJeStunde))} je VE
          · Fertigungsgemeinkosten{' '}
          {euro(
            (profil.maschinenstundensatz + profil.energieJeStunde) /
              Math.max(1, profil.ausbringungJeStunde) +
              profil.ruestkostenJeLos / Math.max(1, profil.losgroesseVe),
          )}{' '}
          je VE
        </p>
      </Karte>

      <Karte titel="Zuschläge auf die Herstellkosten">
        <div className="grid gap-3 sm:grid-cols-2">
          <ZahlFeld
            label="Qualitätssicherung & Labor"
            wert={profil.qualitaetProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ qualitaetProzent: v })}
          />
          <ZahlFeld
            label="Forschung & Entwicklung"
            wert={profil.fuEProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ fuEProzent: v })}
          />
          <ZahlFeld
            label="Verwaltungsgemeinkosten"
            wert={profil.verwaltungProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ verwaltungProzent: v })}
          />
          <ZahlFeld
            label="Vertriebsgemeinkosten"
            wert={profil.vertriebProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ vertriebProzent: v })}
          />
          <ZahlFeld
            label="Logistik je Palette"
            wert={profil.logistikJePalette}
            einheit="€"
            nachkomma={2}
            onChange={(v) => setzen({ logistikJePalette: v })}
          />
          <ZahlFeld
            label="Verkaufseinheiten je Palette"
            wert={profil.vePalette}
            einheit="VE"
            nachkomma={0}
            onChange={(v) => setzen({ vePalette: Math.max(1, v) })}
          />
          <ZahlFeld
            label="Logistik je VE"
            wert={profil.logistikJeVe}
            einheit="€"
            nachkomma={4}
            onChange={(v) => setzen({ logistikJeVe: v })}
          />
          <ZahlFeld
            label="Gewinnzuschlag"
            wert={profil.gewinnzuschlagProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ gewinnzuschlagProzent: v })}
          />
        </div>
      </Karte>

      <Karte titel="Handelsstufe">
        <div className="grid gap-3 sm:grid-cols-2">
          <ZahlFeld
            label="Grundrabatt"
            wert={profil.grundrabattProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ grundrabattProzent: v })}
          />
          <ZahlFeld
            label="Zentralregulierung"
            wert={profil.zentralregulierungProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ zentralregulierungProzent: v })}
          />
          <ZahlFeld
            label="Werbekostenzuschuss"
            wert={profil.wkzProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ wkzProzent: v })}
          />
          <ZahlFeld
            label="Bonus"
            wert={profil.bonusProzent}
            einheit="%"
            nachkomma={1}
            onChange={(v) => setzen({ bonusProzent: v })}
          />
          <ZahlFeld
            label="Handelsspanne"
            wert={profil.handelsspanneProzent}
            einheit="%"
            nachkomma={1}
            hinweis="bezogen auf den Netto-Verkaufspreis"
            onChange={(v) => setzen({ handelsspanneProzent: Math.min(95, Math.max(0, v)) })}
          />
          <ZahlFeld
            label="Mehrwertsteuer"
            wert={profil.mehrwertsteuerProzent}
            einheit="%"
            nachkomma={0}
            onChange={(v) => setzen({ mehrwertsteuerProzent: v })}
          />
        </div>
        <p className="mt-3 text-[12px] text-slate-500">
          Summe der Konditionen:{' '}
          {zahl(
            profil.grundrabattProzent +
              profil.zentralregulierungProzent +
              profil.wkzProzent +
              profil.bonusProzent,
            1,
          )}{' '}
          % auf den Bruttolistenpreis.
        </p>
      </Karte>

      <Knopf onClick={() => setGewaehlt(profile[0]?.id ?? '')} className="w-full">
        Fertig
      </Knopf>
    </div>
  );
}
