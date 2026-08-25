import { create } from 'zustand';
import {
  aktualisiereRezeptur,
  erzeugeStartpreise,
  erzeugeStartprofile,
  loeseFixierung,
  neueId,
  neuesProdukt,
  preisIndex,
  profilId,
  rechneProduktNeu,
  setzeAnteil,
  wendeExtraktionAn,
  type CostingProfile,
  type IngredientPrice,
  type Product,
  type ProductPhoto,
  type Scenario,
  type Hebel,
} from '../lib/costing';
import { KATEGORIE_BY_ID, findeKategorie } from '../lib/data/kategorien';
import {
  analysiereFotos,
  STANDARD_EINSTELLUNGEN,
  istKonfiguriert,
  type VisionEinstellungen,
} from '../lib/vision/analyse';
import {
  holeWert,
  ladeProdukte,
  leereDatenbank,
  loescheProdukt,
  setzeWert,
  speichereProdukt,
} from '../lib/storage/db';

type Zustand = {
  geladen: boolean;
  produkte: Product[];
  aktivId: string | null;
  preise: IngredientPrice[];
  profile: CostingProfile[];
  szenarien: Scenario[];
  einstellungen: VisionEinstellungen;
  vergleichIds: string[];
  fehler: string | null;

  laden: () => Promise<void>;
  setzeFehler: (text: string | null) => void;

  // Produkte
  starteErfassung: () => string;
  waehleProdukt: (id: string | null) => void;
  aendereProdukt: (id: string, aenderung: (p: Product) => Product) => void;
  entferneProdukt: (id: string) => Promise<void>;
  fotoHinzufuegen: (id: string, foto: ProductPhoto) => void;
  fotoEntfernen: (id: string, fotoId: string) => void;
  analysiere: (id: string) => Promise<void>;
  offeneAnalysenNachholen: () => Promise<void>;

  // Rezeptur
  anteilSetzen: (produktId: string, lineId: string, anteil: number) => void;
  fixierungLoesen: (produktId: string, lineId: string) => void;
  zutatZuordnen: (produktId: string, lineId: string, ingredientId: string | null) => void;
  rezepturNeuRechnen: (produktId: string) => void;

  // Stammdaten
  preisAendern: (preis: IngredientPrice) => void;
  preiseZuruecksetzen: () => void;
  profilAendern: (profil: CostingProfile) => void;
  profilZuruecksetzen: (profilId: string) => void;

  // Szenarien und Vergleich
  szenarioSpeichern: (produktId: string, name: string, typ: Scenario['typ'], hebel: Hebel) => void;
  szenarioEntfernen: (id: string) => void;
  vergleichUmschalten: (produktId: string) => void;
  vergleichLeeren: () => void;

  einstellungenSetzen: (e: Partial<VisionEinstellungen>) => void;
  allesLoeschen: () => Promise<void>;
};

const SCHLUESSEL = {
  preise: 'preise',
  profile: 'profile',
  szenarien: 'szenarien',
  einstellungen: 'einstellungen',
};

/** Der API-Schluessel liegt bewusst nur im Browser des Nutzers. */
function ladeEinstellungen(gespeichert: Partial<VisionEinstellungen> | undefined): VisionEinstellungen {
  return { ...STANDARD_EINSTELLUNGEN, ...(gespeichert ?? {}) };
}

export const useStore = create<Zustand>((set, get) => ({
  geladen: false,
  produkte: [],
  aktivId: null,
  preise: erzeugeStartpreise(),
  profile: erzeugeStartprofile(),
  szenarien: [],
  einstellungen: STANDARD_EINSTELLUNGEN,
  vergleichIds: [],
  fehler: null,

  async laden() {
    try {
      const [produkte, preise, profile, szenarien, einstellungen] = await Promise.all([
        ladeProdukte<Product>(),
        holeWert<IngredientPrice[]>(SCHLUESSEL.preise),
        holeWert<CostingProfile[]>(SCHLUESSEL.profile),
        holeWert<Scenario[]>(SCHLUESSEL.szenarien),
        holeWert<Partial<VisionEinstellungen>>(SCHLUESSEL.einstellungen),
      ]);
      produkte.sort((a, b) => b.erfasstAm.localeCompare(a.erfasstAm));
      set({
        geladen: true,
        produkte,
        preise: preise?.length ? preise : erzeugeStartpreise(),
        profile: profile?.length ? profile : erzeugeStartprofile(),
        szenarien: szenarien ?? [],
        einstellungen: ladeEinstellungen(einstellungen),
      });
    } catch (fehler) {
      // Ohne IndexedDB laeuft die App weiter, nur ohne Persistenz.
      set({
        geladen: true,
        fehler:
          fehler instanceof Error
            ? `Lokaler Speicher nicht verfügbar: ${fehler.message}`
            : 'Lokaler Speicher nicht verfügbar.',
      });
    }
  },

  setzeFehler(text) {
    set({ fehler: text });
  },

  starteErfassung() {
    const p = neuesProdukt();
    set((s) => ({ produkte: [p, ...s.produkte], aktivId: p.id }));
    void speichereProdukt(p).catch(() => undefined);
    return p.id;
  },

  waehleProdukt(id) {
    set({ aktivId: id });
  },

  aendereProdukt(id, aenderung) {
    set((s) => {
      const produkte = s.produkte.map((p) => (p.id === id ? aenderung(p) : p));
      const neu = produkte.find((p) => p.id === id);
      if (neu) void speichereProdukt(neu).catch(() => undefined);
      return { produkte };
    });
  },

  async entferneProdukt(id) {
    set((s) => ({
      produkte: s.produkte.filter((p) => p.id !== id),
      aktivId: s.aktivId === id ? null : s.aktivId,
      vergleichIds: s.vergleichIds.filter((v) => v !== id),
      szenarien: s.szenarien.filter((sz) => sz.produktId !== id),
    }));
    await loescheProdukt(id).catch(() => undefined);
    void setzeWert(SCHLUESSEL.szenarien, get().szenarien).catch(() => undefined);
  },

  fotoHinzufuegen(id, foto) {
    get().aendereProdukt(id, (p) => ({
      ...p,
      fotos: [...p.fotos.filter((f) => f.rolle !== foto.rolle), foto].sort(
        (a, b) => reihenfolge(a.rolle) - reihenfolge(b.rolle),
      ),
    }));
  },

  fotoEntfernen(id, fotoId) {
    get().aendereProdukt(id, (p) => ({ ...p, fotos: p.fotos.filter((f) => f.id !== fotoId) }));
  },

  async analysiere(id) {
    const zustand = get();
    const produkt = zustand.produkte.find((p) => p.id === id);
    if (!produkt) return;

    if (!navigator.onLine) {
      zustand.aendereProdukt(id, (p) => ({
        ...p,
        analyseStatus: 'offen',
        analyseFehler: 'Keine Verbindung – die Analyse wird nachgeholt.',
      }));
      return;
    }
    if (!istKonfiguriert(zustand.einstellungen)) {
      zustand.aendereProdukt(id, (p) => ({
        ...p,
        analyseStatus: 'fehler',
        analyseFehler: 'Kein API-Schlüssel hinterlegt. Bitte in den Einstellungen ergänzen.',
      }));
      return;
    }

    zustand.aendereProdukt(id, (p) => ({ ...p, analyseStatus: 'laeuft', analyseFehler: undefined }));
    try {
      const ergebnis = await analysiereFotos(produkt.fotos, zustand.einstellungen);
      get().aendereProdukt(id, (p) => wendeExtraktionAn(p, ergebnis));
    } catch (fehler) {
      const text = fehler instanceof Error ? fehler.message : 'Die Analyse ist fehlgeschlagen.';
      get().aendereProdukt(id, (p) => ({ ...p, analyseStatus: 'fehler', analyseFehler: text }));
    }
  },

  async offeneAnalysenNachholen() {
    const offene = get().produkte.filter((p) => p.analyseStatus === 'offen' && p.fotos.length > 0);
    for (const p of offene) {
      await get().analysiere(p.id);
    }
  },

  anteilSetzen(produktId, lineId, anteil) {
    get().aendereProdukt(produktId, (p) => ({
      ...p,
      recipe: setzeAnteil(p.recipe, lineId, anteil, p.naehrwerte?.wert ?? null, kategorieVon(p)),
    }));
  },

  fixierungLoesen(produktId, lineId) {
    get().aendereProdukt(produktId, (p) => ({
      ...p,
      recipe: loeseFixierung(p.recipe, lineId, p.naehrwerte?.wert ?? null, kategorieVon(p)),
    }));
  },

  zutatZuordnen(produktId, lineId, ingredientId) {
    get().aendereProdukt(produktId, (p) => {
      const lines = p.recipe.lines.map((l) => (l.id === lineId ? { ...l, ingredientId } : l));
      return {
        ...p,
        recipe: aktualisiereRezeptur(
          { ...p.recipe, lines },
          p.naehrwerte?.wert ?? null,
          kategorieVon(p),
        ),
      };
    });
  },

  rezepturNeuRechnen(produktId) {
    get().aendereProdukt(produktId, (p) => rechneProduktNeu(p));
  },

  preisAendern(preis) {
    set((s) => {
      const preise = s.preise.map((p) =>
        p.ingredientId === preis.ingredientId && p.qualitaet === preis.qualitaet ? preis : p,
      );
      void setzeWert(SCHLUESSEL.preise, preise).catch(() => undefined);
      return { preise };
    });
  },

  preiseZuruecksetzen() {
    const preise = erzeugeStartpreise();
    set({ preise });
    void setzeWert(SCHLUESSEL.preise, preise).catch(() => undefined);
  },

  profilAendern(profil) {
    set((s) => {
      const profile = s.profile.map((p) => (p.id === profil.id ? profil : p));
      void setzeWert(SCHLUESSEL.profile, profile).catch(() => undefined);
      return { profile };
    });
  },

  profilZuruecksetzen(id) {
    set((s) => {
      const original = erzeugeStartprofile().find((p) => p.id === id);
      if (!original) return {};
      const profile = s.profile.map((p) => (p.id === id ? original : p));
      void setzeWert(SCHLUESSEL.profile, profile).catch(() => undefined);
      return { profile };
    });
  },

  szenarioSpeichern(produktId, name, typ, hebel) {
    set((s) => {
      const vorhanden = s.szenarien.find((sz) => sz.produktId === produktId && sz.name === name);
      const szenario: Scenario = {
        id: vorhanden?.id ?? neueId('sz'),
        produktId,
        name,
        typ,
        hebel,
        erstelltAm: new Date().toISOString(),
      };
      const szenarien = vorhanden
        ? s.szenarien.map((sz) => (sz.id === vorhanden.id ? szenario : sz))
        : [...s.szenarien, szenario];
      void setzeWert(SCHLUESSEL.szenarien, szenarien).catch(() => undefined);
      return { szenarien };
    });
  },

  szenarioEntfernen(id) {
    set((s) => {
      const szenarien = s.szenarien.filter((sz) => sz.id !== id);
      void setzeWert(SCHLUESSEL.szenarien, szenarien).catch(() => undefined);
      return { szenarien };
    });
  },

  vergleichUmschalten(produktId) {
    set((s) => {
      if (s.vergleichIds.includes(produktId)) {
        return { vergleichIds: s.vergleichIds.filter((id) => id !== produktId) };
      }
      if (s.vergleichIds.length >= 4) return {};
      return { vergleichIds: [...s.vergleichIds, produktId] };
    });
  },

  vergleichLeeren() {
    set({ vergleichIds: [] });
  },

  einstellungenSetzen(teil) {
    set((s) => {
      const einstellungen = { ...s.einstellungen, ...teil };
      void setzeWert(SCHLUESSEL.einstellungen, einstellungen).catch(() => undefined);
      return { einstellungen };
    });
  },

  async allesLoeschen() {
    await leereDatenbank().catch(() => undefined);
    set({
      produkte: [],
      aktivId: null,
      szenarien: [],
      vergleichIds: [],
      preise: erzeugeStartpreise(),
      profile: erzeugeStartprofile(),
    });
  },
}));

function reihenfolge(rolle: ProductPhoto['rolle']): number {
  return { vorderseite: 0, zutaten: 1, naehrwerte: 2, rueckseite: 3 }[rolle];
}

function kategorieVon(p: Product) {
  return KATEGORIE_BY_ID.get(p.kategorie.wert) ?? findeKategorie(p.kategorie.wert);
}

/** Liefert das Kalkulationsprofil eines Produkts, mit Rueckfall auf die Kategorie. */
export function profilFuer(produkt: Product, profile: CostingProfile[]): CostingProfile {
  return (
    profile.find((p) => p.id === produkt.profileId) ??
    profile.find((p) => p.id === profilId(produkt.kategorie.wert)) ??
    profile[profile.length - 1]
  );
}

/** Preisindex fuer die Kalkulation. */
export function preisMap(preise: IngredientPrice[]) {
  return preisIndex(preise);
}
