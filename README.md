# Veranstaltungskalender Mühlhausen 2026

Eine statische Webseite, die Veranstaltungen in Mühlhausen/Thüringen nach Monaten
geordnet anzeigt. Die Seite kommt ohne externe Bibliotheken aus – es gibt nur drei
Dateien:

| Datei         | Inhalt                                                       |
|---------------|--------------------------------------------------------------|
| `index.html`  | Die komplette Seite inklusive CSS und JavaScript              |
| `events.json` | Die Termine – **nur diese Datei musst du im Alltag anfassen** |
| `README.md`   | Diese Anleitung                                               |

## Was die Seite kann

- Termine nach Monaten gegliedert
- Filter nach Kategorie (die Kategorien entstehen automatisch aus `events.json`)
- Suchfeld über Titel, Kategorie, Ort und Beschreibung
- Vergangene Termine sind ausgeblendet und lassen sich per Häkchen einblenden –
  eingeblendet werden sie ausgegraut dargestellt
- Der nächste anstehende Termin steht oben hervorgehoben, mit Angabe wie
  „in 3 Wochen“
- Für das Handy gebaut, mit heller und dunkler Darstellung je nach
  Systemeinstellung

## Termine ergänzen

Termine stehen in `events.json`. Die Datei ist eine Liste in eckigen Klammern
`[ ... ]`, jeder Termin ist ein Block in geschweiften Klammern `{ ... }`.
Zwischen zwei Blöcken steht ein Komma.

Ein neuer Termin sieht so aus:

```json
  {
    "datum": "2026-09-19",
    "zeit": "19:00",
    "titel": "Chorkonzert in der Marienkirche",
    "kategorie": "Musik",
    "ort": "Marienkirche, Mühlhausen",
    "beschreibung": "Geistliche Chormusik aus vier Jahrhunderten. Eintritt frei, Spenden erbeten.",
    "link": "https://www.muehlhausen.de/"
  }
```

Kopiere einen vorhandenen Block, füge ihn ein und passe die Werte an. Achte
darauf, dass zwischen allen Blöcken ein Komma steht – aber **nach dem letzten
Block kein Komma**. Das ist der häufigste Fehler.

### Die Felder

| Feld           | Pflicht | Beschreibung                                                                 |
|----------------|---------|------------------------------------------------------------------------------|
| `datum`        | ja      | Immer im Format `JJJJ-MM-TT`, also `2026-09-19` für den 19. September 2026    |
| `titel`        | ja      | Name der Veranstaltung, erscheint als Überschrift                            |
| `kategorie`    | nein    | z. B. `Musik`, `Markt`, `Sport`. Daraus entstehen die Filter-Knöpfe          |
| `ort`          | nein    | Veranstaltungsort, gern mit Straße                                           |
| `beschreibung` | nein    | Ein bis drei Sätze zum Termin                                               |
| `link`         | nein    | Vollständige Adresse mit `https://`. Erscheint als „Mehr erfahren“           |
| `zeit`         | nein    | Uhrzeit als `19:00`. Wird als „19:00 Uhr“ angezeigt                          |

Nicht benötigte Felder kannst du weglassen oder leer lassen (`"link": ""`).
Die Reihenfolge in der Datei ist egal – die Seite sortiert die Termine selbst
nach Datum. Neue Kategorien musst du nirgends anmelden: Sobald ein Termin eine
neue Kategorie enthält, erscheint dafür automatisch ein Filter-Knopf.

### Umlaute und Sonderzeichen

Umlaute kannst du ganz normal schreiben (`Mühlhausen`). Speichere die Datei
dabei als UTF-8 – das machen alle gängigen Editoren von sich aus.

Anführungszeichen innerhalb eines Textes müssen mit einem Backslash geschützt
werden:

```json
"beschreibung": "Das Stück \"Wachet auf\" steht am Anfang."
```

Einfacher ist es, in Beschreibungen auf Anführungszeichen zu verzichten.

### Termin absagen oder entfernen

Lösche den kompletten Block von `{` bis `}` samt dem Komma davor oder dahinter.
Alternativ kannst du ihn stehen lassen und im Titel `(abgesagt)` ergänzen –
dann bleibt der Hinweis für Besucher sichtbar.

## GitHub Pages einschalten (einmalig)

Damit die Seite im Browser erreichbar ist, muss GitHub Pages einmal von Hand
eingeschaltet werden – das lässt sich nur mit Besitzerrechten erledigen:

1. Im Repository oben auf **Settings** klicken
2. Links im Menü auf **Pages**
3. Unter „Build and deployment“ bei **Source** den Eintrag
   **Deploy from a branch** wählen
4. Bei **Branch** den Branch `main` auswählen, als Ordner `/ (root)` stehen
   lassen
5. Auf **Save** klicken

Nach ein bis zwei Minuten ist die Seite hier erreichbar:

<https://rschramm0572-creator.github.io/Probe/>

## Änderungen veröffentlichen

Sobald Pages eingeschaltet ist, genügt eine Änderung an `events.json` im
Branch `main`: GitHub veröffentlicht die Seite dann von selbst neu, in der
Regel innerhalb von ein bis zwei Minuten.

Am bequemsten geht das direkt im Browser:

1. In diesem Repository oben links prüfen, dass `main` ausgewählt ist, dann
   auf `events.json` klicken
2. Oben rechts auf das Stift-Symbol („Edit this file“)
3. Termin ergänzen
4. Unten auf „Commit changes“ klicken

Wenn du dich vertippst und die Datei kein gültiges JSON mehr ist, zeigt die
Seite statt der Termine einen Hinweis an. Der Fehler lässt sich dann mit einem
JSON-Prüfer (z. B. <https://jsonlint.com/>) schnell finden.

## Lokal ausprobieren

Ein Doppelklick auf `index.html` reicht **nicht** – Browser blockieren aus
Sicherheitsgründen das Nachladen von `events.json`, wenn die Seite direkt von
der Festplatte geöffnet wird. Die Seite zeigt in dem Fall einen entsprechenden
Hinweis.

Stattdessen im Projektordner einen kleinen Server starten:

```bash
python3 -m http.server 8000
```

Danach im Browser <http://localhost:8000> aufrufen. Auf GitHub Pages tritt das
Problem nicht auf.

## Hinweis zu den Beispieldaten

Die zehn mitgelieferten Termine sind Beispieldaten zur Veranschaulichung und
keine offiziellen Ankündigungen. Bitte durch echte Termine ersetzen.

---

## Weiteres Projekt in diesem Repository

Im Verzeichnis [`kalkulens/`](kalkulens/) liegt **KalkuLens**, eine eigenständige
Web-App zur foto-basierten Produktkalkulation im Lebensmitteleinzelhandel
(Rohware → Vollkosten). Sie hat mit dem Veranstaltungskalender nichts zu tun und
bringt eigene Abhängigkeiten und eine eigene Anleitung mit – siehe
[`kalkulens/README.md`](kalkulens/README.md).
