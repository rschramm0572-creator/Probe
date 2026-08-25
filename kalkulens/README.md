# KalkuLens

Foto-basierte Produktkalkulation für den Lebensmitteleinzelhandel: ein verpacktes
Produkt am Regal fotografieren und in Minuten eine strukturierte Kostenschätzung
erhalten – von den Rohwarenkosten über die Herstellkosten bis zu den Vollkosten
und dem daraus ableitbaren Abgabepreis.

**Leitgedanke:** transparente Schätzung statt Scheinpräzision. Jede Annahme ist
sichtbar, editierbar und mit einer Unsicherheitsangabe versehen. Die App behauptet
nicht, die tatsächliche Rezeptur oder Kalkulation eines Herstellers zu kennen.

## Schnellstart

```bash
npm install
npm run dev          # Entwicklungsserver
npm test             # 73 Unit-Tests (Rezepturrückrechnung, Kalkulationsschema, Export)
npm run build        # Typprüfung und Produktionsbuild nach dist/
```

Ohne API-Schlüssel lädt der Startbildschirm über **Demodaten laden** zwei
Beispielprodukte (Markenartikel und Handelsmarke derselben Warengruppe). Damit
lässt sich die gesamte Rechenkette einschließlich Vergleich und Export
nachvollziehen.

Für die Bilderkennung wird unter **Einstellungen** ein Anthropic-API-Schlüssel
hinterlegt. Er wird ausschließlich lokal im Browser gespeichert. Für den Rollout
im Außendienst gehört ein eigener Proxy davor – dessen Basis-URL nimmt dasselbe
Formular entgegen.

## Ablauf

1. **Erfassen** – ein bis vier Fotos: Vorderseite, Zutatenliste, Nährwerttabelle,
   Rückseite. Kamera oder Galerie. Ohne Verbindung erfasste Produkte werden
   gespeichert und automatisch analysiert, sobald wieder eine Verbindung besteht.
2. **Erkennen** – ein Vision-Modell liest die Etikettenangaben aus und liefert sie
   als striktes JSON mit Konfidenzwert je Feld.
3. **Prüfen** – Felder unter 70 % Konfidenz sind gelb markiert. Jede Korrektur
   bestätigt den Wert; geschätzte Werte sind gestrichelt, bestätigte durchgezogen
   umrandet.
4. **Kalkulieren** – Rohware → Herstellkosten → Vollkosten, mit Wasserfall und
   aufklappbarer Detailtabelle. Jede Zahl lässt sich per Tap bis auf ihre Annahme
   zurückverfolgen.
5. **Simulieren** – Schieberegler für die fünf größten Kostentreiber, Tornado-
   Diagramm, Stresstest und speicherbare Szenarien.
6. **Exportieren** – Excel mit lebenden Formeln, PDF als einseitiges
   Management-Summary. Beide tragen den Hinweis auf den Schätzcharakter.

## Methodik der Rezepturrückrechnung

Das methodische Herzstück liegt in `src/lib/costing/rezeptur.ts`. Aus vier
unabhängigen Informationsquellen wird ein Anteilsvektor bestimmt, der zu allen
vier gleichzeitig passt:

| Quelle | Wirkung |
|---|---|
| **Reihenfolgeregel** | Die Zutatenliste ist absteigend nach Gewicht sortiert. Position *i* kann höchstens 100/*i* Prozent tragen – eine harte Schranke. |
| **QUID-Anker** | Deklarierte Prozentangaben sind Fixpunkte und werden nie überschrieben. |
| **Nährwertabgleich** | Aus der geschätzten Rezeptur werden die Nährwerte je 100 g zurückgerechnet und gegen die Deklaration optimiert. Die Restabweichung je Nährwert wird ausgewiesen. |
| **Kategoriewissen** | 14 Warengruppen mit typischen Rezepturkorridoren – als Startwert und als Plausibilitätsschranke. |

Gelöst wird das als beschränktes Kleinste-Quadrate-Problem mit projiziertem
Gradientenabstieg. Die zulässige Menge (Summe 100 %, Schranken, absteigende
Reihenfolge) ist konvex; die Projektion setzt Fixwerte, erzwingt die Monotonie
und normiert die freien Anteile.

Eine Besonderheit verdient Erwähnung: die Nährwerte unterscheiden sich um
Größenordnungen – Energie in Kilojoule, Salz in Zehntelgramm. Ohne
Vorkonditionierung springt das Verfahren in der Salzrichtung und steht in der
Energierichtung. Der Schritt wird deshalb je Koordinate mit der Diagonale der
Hesse-Matrix skaliert, und der Ausgleich für die Summenbedingung wird in
derselben Metrik verteilt – eine scharf bestimmte Zutat wie Salz trägt sonst den
Ausgleich für die grob bestimmten Hauptzutaten.

Wasserzugabe, Back-, Trocknungsverlust und produktionsbedingter Schwund stecken in
einer eigenen, kategorieabhängigen Verlustquote (Standard 2–5 %, editierbar). Sie
erhöht die Einsatzmenge gegenüber der Füllmenge.

Jede Zeile ist manuell überschreibbar. Ein überschriebener Wert wird fixiert, die
übrigen Anteile werden neu normiert und erneut gegen die Nährwerte optimiert.

## Kalkulationsschema

```
  Rohwarenkosten
+ Verpackungskosten            (Primär, Sekundär, Tertiär, Lizenzentgelt)
= Materialeinzelkosten
+ Materialgemeinkosten         (Standard 4 %)
+ Fertigungseinzelkosten       (Personalkosten × Personen ÷ Ausbringung/h)
+ Fertigungsgemeinkosten       (Maschinenstundensatz, Energie, Rüstkosten ÷ Losgröße)
= HERSTELLKOSTEN
+ Qualitätssicherung & Labor   (Standard 1 %)
+ Forschung & Entwicklung      (Standard 1,5 %)
+ Verwaltungsgemeinkosten      (Standard 5 %)
+ Vertriebsgemeinkosten        (Standard 6 %)
+ Logistik & Lagerung          (je Palette und je VE)
= VOLLKOSTEN (Selbstkosten)
+ Gewinnzuschlag
= Kalkulatorischer Abgabepreis
```

Daran schließt die Handelsstufe an – Konditionen, Handelsspanne, Mehrwertsteuer –
sowie, sobald ein Regalpreis erfasst ist, die **Rückwärtskalkulation**: vom
Verbraucherpreis über Handelsspanne und Konditionen auf den impliziten
Abgabepreis, verglichen mit den kalkulierten Vollkosten. Ergebnis ist eine
geschätzte Herstellermarge in Prozent und in Euro, mit Bandbreite aus der
Rezepturunsicherheit.

Alle Zuschlagssätze sind editierbar und werden als Profil je Produktkategorie
gespeichert. Rüst- und Fertigungsgemeinkosten verteilen sich degressiv auf die
Losgröße; die Stückkosten für 50.000 / 250.000 / 1.000.000 VE p. a. stehen
nebeneinander.

## Aufbau

```
src/
  lib/
    costing/          Kalkulationslogik, vollständig UI-frei und testbar
      types.ts          Datenmodell (Product, Recipe, PackagingSpec, CostingProfile …)
      zutatenParser.ts  Zutatenliste → strukturierte Einträge inkl. QUID
      rezeptur.ts       Rezepturrückrechnung und Nährwertabgleich
      preise.ts         Rohstoffpreisdatenbank mit Staffeln und Qualitätsstufen
      verpackung.ts     Verpackungsschätzung über drei Ebenen
      vollkosten.ts     Zuschlagskalkulation, Handelsstufe, Rückwärtsrechnung
      sensitivitaet.ts  Tornado, Stresstest, Szenarien
      extraktion.ts     Vertrag und Normalisierung der Bilderkennung
      produkt.ts        Produktfabrik und Neuberechnung
    data/
      ingredients.ts    100 Rohstoffe mit Nährwertprofil je 100 g und Basispreis
      kategorien.ts     14 Warengruppen mit Korridoren und Fertigungsparametern
      demo.ts           Zwei Demodatensätze
    vision/           Anthropic Messages API mit Bild-Input, Antwort als JSON-Schema
    storage/          IndexedDB (Produkte, Preise, Profile, Szenarien, Einstellungen)
    export/           Excel (SheetJS) und PDF (jsPDF), beide clientseitig
  components/         Wiederverwendbare Bausteine und Diagramme
  screens/            Erfassen, Prüfen, Ergebnis, Simulation, Bibliothek, Vergleich, Stammdaten
  state/              Zustand-Store
```

Die Trennung ist strikt: `lib/costing/` kennt kein React und keine DOM-API. Die
Unit-Tests laufen deshalb in einer reinen Node-Umgebung.

## Tests

```bash
npm test
```

73 Tests in vier Dateien:

- **`rezeptur.test.ts`** – Parser (Reihenfolge, QUID, Dezimalkomma,
  zusammengesetzte Zutaten, Bio-Kennzeichnung), Grundregeln der Rückrechnung
  (Normierung auf 100 %, Monotonie, harte Schranken, Determinismus), Nährwert-
  abgleich gegen bekannte Referenzrezepturen und manuelle Korrektur.
- **`vollkosten.test.ts`** – jede Stufe des Kalkulationsschemas, Zuschlagsbasen,
  Verpackung über drei Ebenen, Losgrößendegression, Invertierbarkeit von
  Vorwärts- und Rückwärtsrechnung, Sensitivität und Robustheit gegen leere oder
  extreme Eingaben.
- **`excel.test.ts`** – Blattstruktur, lebende Formeln und ihr Überleben im
  Schreib-Lese-Durchlauf.
- **`format.test.ts`** – deutsche Zahlennotation in beide Richtungen.

Der Referenztest für die Rückrechnung arbeitet rückwärts: aus einer bekannten
Rezeptur werden die Nährwerte exakt erzeugt, dann muss die Schätzung sie wieder
treffen – für Standardprodukte mit unter 15 % Abweichung je Nährwert.

Zusätzlich prüft ein Rauchtest im echten Browser den gesamten Ablauf einschließlich
beider Exporte:

```bash
npm run build
npm run preview          # in einem zweiten Terminal
npm run smoke
```

## Technik

React 19 · TypeScript · Vite · Tailwind CSS 4 · Recharts · Zustand ·
SheetJS · jsPDF · Anthropic Messages API

Die Diagrammfarben folgen einer auf Farbfehlsichtigkeit geprüften Palette:
eine Hue als Magnitudenskala im Wasserfall, ein divergierendes Paar im Tornado,
feste kategoriale Slots im Vergleich.

## Datenschutz

Produkte, Fotos, Preise und Profile liegen ausschließlich im Browser des Nutzers
(IndexedDB). Es gibt keine Serverkomponente. Die Fotos verlassen das Gerät nur für
die Analyse und nur an die Anthropic API. Verarbeitet werden ausschließlich
Angaben, die auf der Verpackung öffentlich lesbar sind; fremde Kalkulationsdaten
Dritter werden weder verarbeitet noch gespeichert.

## Nicht-Ziele in Version 1

- keine Echtzeitanbindung an Rohstoffbörsen – Preise werden gepflegt
- keine Behauptung, die tatsächliche Herstellerrezeptur zu kennen
- keine Verarbeitung fremder Kalkulationsdaten Dritter
