# Brief: Die WorkFlohs bekommen dieselbe Maschine wie Workflow PDF

Sitzung: Tomys WorkFloh (`Tomys-Hub/workfloh/`) und Mein-WorkFloh bekommen das Scannen
und das PDF-Bearbeiten aus Workflow PDF mit **derselben Technik und denselben
Ergebnissen**. Das Aussehen darf eigen bleiben.
Auftrag: Klaus, 2026-09-27. Geschrieben am selben Tag, gegen den Stand `origin/main`.

## Klaus' Auftrag, wörtlich

> „Es sollen alle Funktionen, die in Workflow PDF für PDF bearbeiten und PDF scannen,
> Foto PDF scannen und PDF oder Bild aus Ordner einfügen und so weiter … gleich sein wie
> im PDF Workflow, die ganze Maschinerie dahinter. Scannen, das Bearbeiten der gescannten
> Bilder, das Erstellen, Teilen, PDF herunterladen, soll nicht genauso aufgebaut sein,
> aber dieselbe Technik haben. Es sollen zu denselben Ergebnissen führen. Kamerafoto,
> Galeriefoto, das Zurechtziehen der Bilder, da ist eine Maschine dahinter … Genauso PDF
> bearbeiten. Das funktioniert schon, glaube ich, zum größten Teil. Das prüft bitte noch
> mal nach, ob das auch genau dieselbe Maschine ist … damit derjenige, der an PDF
> Workflow arbeitet und an Tommy und an mein Workflow dieselbe Maschinerie findet."

## Zuerst lesen

- Workflow-PDF/CLAUDE.md, Abschnitte „📷 Scannen · Foto → PDF" und „📝 PDF-Werkzeug" (in den WorkFlohs)
- Mein-WorkFloh/CLAUDE.md und Tomys-Hub/CLAUDE.md, Abschnitt „📝 PDF-Werkzeug aus Workflow-PDF"
- Workflow-PDF/docs/TODO.md, Abschnitt „Tomys WorkFloh". Punkt 1 dort („PDF bearbeiten wie
  Workflow PDF aufbauen") ist die Oberflächen-Hälfte desselben Auftrags. **Beides zusammen
  planen**, aber einzeln mergen.
- Workflow-PDF/docs/sessions/ABSCHLUSS_2026-09-27_scannen-lupe.md (Stand, Messungen)

## Pflicht vor jeder Arbeit

```bash
for r in Workflow-PDF Mein-WorkFloh Tomys-Hub; do git -C $r fetch origin --quiet; done
git -C Workflow-PDF grep -c "lupeGroesse" origin/main -- assets/scanner.js   # ≥ 1, sonst fehlt die kleine Lupe
```

Den Arbeitszweig in jedem Depot frisch von `origin/main` anlegen.

## Befund vom 2026-09-27: gemessen, nicht vermutet (SHA-256 gegen `origin/main`)

| Datei | Workflow PDF | Mein-WorkFloh | Tomys WorkFloh |
|---|---|---|---|
| erkennung · export · html-export · uebersetzung · blatt · zip · sprechen | ✔ | **byte-gleich** | **byte-gleich** |
| pdf-lib · fontkit (vendor) | ✔ | byte-gleich | byte-gleich |
| **scanner.js · scan-bild.js · vendor/scanic** | ✔ | **fehlt** | **fehlt** |
| suche.js | ✔ | fehlt | fehlt (Stufe 3, eigener Auftrag) |
| werkzeug.js · auswahl.js | — | gleich in beiden | gleich in beiden |

**Was daraus folgt:**

1. **Scannen ist NICHT dieselbe Maschine.** Die WorkFlohs nehmen ein Foto über
   `fotoBlatt()` in werkzeug.js entgegen, und das nutzt nur `blatt.js`. Das ist **eine** der
   drei Meinungen, auf die Workflow PDF seit dem 26.09. seine Entscheidung stützt.
   Es fehlen: das Scanic-Modell und die Scanic-Kanten, das Ecken-Ziehen mit Lupe,
   „bitte prüfen" statt still schneiden, die Filter, Drehen, mehrere Seiten, die
   Texterkennung, „Kopie neben Original", der ChatGPT-Weg, durchsuchbares PDF und ZIP.
   Gemessen an 17 Testfotos (Workflow-PDF/tests/scan-fotos):
   - `blatt.js` allein: 3 Fotos „sicher", aber 11–27 % daneben (still falsch geschnitten)
   - Entscheidung aus drei Meinungen: **0** sicher und falsch
2. **Beim PDF-Bearbeiten sind die Bibliotheken dieselben, der Editor nicht.** Workflow PDF
   bearbeitet in `assets/app.js`, die WorkFlohs in `werkzeug.js` plus dem `ov*`-Code in
   `index.html`. Beides ist von Hand parallel gehalten und schon auseinandergelaufen:
   `typAusLabel` hat in app.js und werkzeug.js **verschiedene** Prüfsummen. Die Feldart,
   die aus einer Beschriftung vorgeschlagen wird, kann also je App anders ausfallen.
3. **Die Zusage „byte-1:1" hat in den WorkFlohs keinen Wächter.** Heute stimmt sie (siehe
   Tabelle), aber keine Probe dort pinnt eine Prüfsumme. Beim nächsten Kopieren fällt ein
   Auseinanderlaufen niemandem auf. *Ein Drift-Guard sagt „unverändert", nicht „aktuell"*,
   und hier gibt es nicht einmal den.

## Der Weg (Vorschlag, Klaus entscheidet am Anfang in einer Zeile)

**Grundsatz: kopieren, nicht nachbauen.** Die Maschine wird aus Workflow PDF kopiert, byte-1:1,
mit Prüfsumme gepinnt. Nachgebaut wird nur der Klebstoff, also die Frage, wohin das fertige
PDF geht.

**Schritt 0 · Wächter zuerst.** Eine Probe je WorkFloh pinnt alle byte-1:1-Dateien unter
`assets/wfpdf/` per SHA-256 auf die Fassung in Workflow PDF. Beim Kopieren werden die Pins
nachgezogen. Gegenprobe: ein Zeichen in einer Kopie ändern, dann muss genau diese Zeile rot
werden. Dieser Schritt kostet nichts und macht aus „glaube ich" eine Messung.

**Schritt 1 · Scannen.** `scanner.js`, `scan-bild.js` und `vendor/scanic/` byte-1:1 nach
`assets/wfpdf/` in beiden WorkFlohs kopieren.
- `WFP.Scanner.oeffnen({...})` bekommt dieselben Rückrufe wie in app.js `scanStarten`:
  `toast`, `dialog`, `frage`, `fortschritt`, `laden`, `ablegen`, `fertig`.
- `ablegen`/`fertig` im WorkFloh = **Anhang am Auftrag** (bzw. Einzeldokument), statt der
  Bibliothek von Workflow PDF.
- Ersetzt werden: der Kamera-/Galerie-Weg in `anhangWaehlen()` und `fotoBlatt()` (werkzeug.js).
  Wo `fotoBlatt` noch still gebraucht wird (Bild aus einem Ordner einfügen), geht es durch
  dieselbe Entscheidung `WFP.ScanBild.entscheiden`, kein eigener Weg.
- Große Dateien laden wie die Texterkennung von der gleichen Adresse
  (`/Workflow-PDF/vendor/scanic/`, 3,5 MB), mit `ml: { assetBaseUrl }`, sonst holt Scanic
  sie von jsDelivr. Nicht in den Installations-Vorrat legen.
- Die Sprachschicht fehlt in den WorkFlohs. Die deutschen Texte des Scanners bleiben dann
  Deutsch, und das ist dort richtig.
- Klaus' Wort zum Aussehen gilt auch hier: Aufbau und Abläufe wie in Workflow PDF,
  **Knopfform, Farbe und Wackeln WorkFloh-eigen**. `scanner.js` bringt sein Aussehen über
  Klassen (`.scan-*`) mit. Die gehören ins Stylesheet der App, nicht in die Kopie.

**Schritt 2 · PDF bearbeiten: eine Quelle.** Aus app.js und werkzeug.js alles, was keine
Oberfläche ist, in eine geteilte Datei ziehen: `typAusLabel`, `schluesselVorschlag`,
`inhaltLesen`, `linkZiel`/`ovLinkZiel`, `zuschneiden`, `dateiName`, Teil-Plan,
Nummern-Erkennung. Vorschlag: `assets/feld-logik.js` in Workflow PDF, byte-1:1 in die
WorkFlohs.
- app.js und werkzeug.js rufen sie nur noch auf.
- Vorher je Funktion messen, welche Fassung **richtig** ist. Sie sind auseinandergelaufen,
  und zu raten wäre die stillste Sorte Fehler.
- Die Zusage ist erfüllt, wenn dieselbe Beschriftung in allen drei Apps dieselbe Feldart
  ergibt. Das misst eine Probe an einer Liste erfundener Beschriftungen.

**Schritt 3 · Oberfläche** (TODO Tomy Punkt 1 und 2): Aufbau des Bearbeiten-Fensters wie in
Workflow PDF, Schieberegler unter der Feldarten-Leiste. Erst Tomys WorkFloh, dann
Mein-WorkFloh.

**Reihenfolge:** 0 → 1 → 2 → 3, je ein PR je Depot und Schritt. Tomys WorkFloh und
Mein-WorkFloh bleiben **parallel**, wie die BookLedgerPro-Brücke: `werkzeug.js` ist in
beiden identisch, und eine Probe prüft das.

## Was „dieselben Ergebnisse" heißt: so wird es gemessen

- **Blatt finden:** das Gleiche an den 17 Testfotos, aus dem WorkFloh heraus gerufen.
  Es müssen dieselben Ecken und derselbe Befund sicher/prüfen herauskommen wie in
  Workflow-PDF/tests/scan.mjs Abschnitt B, also 12 · 5 · 0.
- **Foto → PDF:** dasselbe gestellte Foto (erfundene Rechnung, aus scan.mjs), dieselben
  Einstellungen. Das PDF hat dieselbe Seitenzahl, Seitengröße und Textebene. Die Bytes sind
  wegen der Zeitstempel nicht gleich; gemessen wird deshalb der Inhalt, nicht die Datei.
- **Feldart aus Beschriftung:** dieselbe Liste, dasselbe Ergebnis in allen drei Apps.
- **Handy 360×740:** Foto mindestens ein Drittel der Höhe, alle vier Ecken greifbar, Lupe
  höchstens 64 px und nicht über dem Punkt. Dieselben Wächter wie in scan.mjs, im WorkFloh.
- Jede Zusicherung bekommt ihre Gegenprobe in einer Wegwerf-Kopie. Jede rote Zeile wird von
  Hand gelesen: *„gefangen" allein ist keine Messung.*

## Was NICHT dazugehört

- Die Suche (Stufe 3). Sie hat einen eigenen Auftrag: getrennt je WorkFloh und nur entsperrt.
- Die Sprachschicht in den WorkFlohs.
- Auftragsdaten des WorkFloh-Kunden **nie** an ChatGPT. Der ChatGPT-Weg des Scanners teilt
  nur das Seitenbild, und nur auf ausdrücklichen Tipp.

## Offen, für Klaus

1. Soll „Bild aus Ordner einfügen" in den WorkFlohs auch durch den Scanner gehen, mit
   Ecken-Ziehen? Oder soll es wie heute still auf A4 gezogen werden, nur mit der besseren
   Entscheidung?
2. Wie heißt der Knopf in der Akte? Vorschlag: „📷 Scannen". Er ersetzt „📷 Foto" /
   „🖼 Galerie" dort.

## Regeln

- Nur erfundene Testdaten.
- In jedem Depot `CACHE_VERSION` in sw.js hochzählen.
- Mergen nach Freibrief.
- Klaus' Sichttest am Tablet ist nicht ersetzbar: die Adresse **im Chat** hinlegen.
- Am Ende: Abschlussbrief mit gemessenem Stundennachweis, Forschungseintrag in Kimhub, neuer
  Brief als Codeblock im Chat.
