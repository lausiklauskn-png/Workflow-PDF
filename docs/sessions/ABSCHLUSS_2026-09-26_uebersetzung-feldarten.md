# Abschluss 2026-09-26: Übersetzen, Oberflächen-Sprachen, Feldarten

**Das ist ein Stand, kein Auftrag.** Wer später an Workflow-PDF, Mein-WorkFloh oder
Tomys WorkFloh arbeitet, findet hier, was gebaut ist, was gemessen ist, was offen ist
und wo es liegt. Aufgeschrieben gegen `origin/main` **nach** dem letzten Merge
(Workflow-PDF #29, Mein-WorkFloh #214, Tomys-Hub #193).

Nachprüfen, ob `main` diesen Stand trägt:

```bash
git -C Workflow-PDF  grep -c "Beschriftungs-Spalten" origin/main -- CLAUDE.md          # ≥ 1
git -C Mein-WorkFloh grep -c "erkennenDialog"        origin/main -- assets/wfpdf/werkzeug.js
git -C Tomys-Hub     grep -c "erkennenDialog"        origin/main -- workfloh/assets/wfpdf/werkzeug.js
```

Jede dieser Zahlen muss über 0 liegen. Steht irgendwo 0, ist ein Merge nicht angekommen.

---

## 1. Was gebaut ist, nach Repo

### Workflow-PDF (die Quelle, #13 bis #29)

| PR | Was |
|---|---|
| #14 | 🌐 Übersetzen: PDF-Ordner DE ↔ RU ↔ EN, Seite für Seite in die Lage des Originals |
| #15 | Behördenformulare: Felder übersetzt mitnehmen, Rückweg „↩ Einträge ins Original", Papierbrief auf A4 (`blatt.js`) |
| #16 | Teilergebnis bei Abbruch wird sichtbar („[RU, Teil N von M]") |
| #17 | „Mit Chrome übersetzen" (kostenlos, ohne Limit); die App wartet das Tempo-Limit der KI ab |
| #18 | Schrift **nie** als Teilmenge einbetten (fehlende Buchstaben), „In Chrome öffnen" mit Rückweg |
| #19 | Benutzerhandbuch und Beispiel-Amtsformular (erfunden, Musterstadt) in der App |
| #20 | keine Textüberlagerung mehr, Text in Bildern wird übersetzt, Chrome-Knopf mit Rückweg |
| #21 bis #23 | Android: kein Sprung nach Chrome, sondern **Teilen → Chrome** (so trägt es am Tablet) |
| #24 | eine Übersetzung wird nie weiterübersetzt; falsche Chrome-Zielsprache wird erkannt |
| #25 | Ergebnisse liegen im Stamm-Ordner, Ordnernamen ziehen mit |
| #26 | falsche Zielsprache in **jeder** Schrift erkennen (Anlass: Paschtu), nicht nur Kyrillisch |
| #27 | Teilen-Weg auch unter Samsung DeX, Hinweis „⟳ tippen" nach der Rückkehr |
| #28 | Oberfläche offline übersetzbar: Deutsch · English · Русский · العربية (RTL) |
| #29 | Beschriftungs-Spalten bleiben neben ihren Feldern, Textfarbe nicht mehr blass |

Die Einzelheiten und alle Fallen stehen in `CLAUDE.md`, Abschnitte „🌐 Übersetzen",
„🗣 Sprache der App-Oberfläche" und „📘 Handbuch und Beispiel-Formular".

### Mein-WorkFloh (#198 bis #214) und Tomys-Hub/workfloh (#177 bis #193)

Beide WorkFlohs bekommen dasselbe, jede Änderung mit einem PR je Repo:

| Mein / Tomys | Was |
|---|---|
| #198 / #177 | PDF-Werkzeug aus Workflow-PDF: Originaldokument einlesen, PDF am Auftrag bearbeiten |
| #203 / #182 | 🌐 PDF übersetzen am Auftrag |
| #204 bis #211 / #183 bis #190 | Übersetzungs-Kern jeweils nachgezogen (Papierbrief, Teilergebnis, Chrome-Weg, Schrift, Bildtext, Zielsprache) |
| #212 / #191 | „Mit Chrome übersetzen" aus dem App-Fenster über **Teilen** |
| #213 / #192 | Akte: Dateinamen lesbar (bis 3 Zeilen, voller Name beim Zeigen), Anzeige-Kopf nicht mehr unter der Mycel-Pille |
| #214 / #193 | **Feldarten** wie in Workflow PDF und die Wahl beim Einlesen (siehe Abschnitt 2) |

Die Übersicht dazu steht in beiden WorkFloh-`CLAUDE.md`, Abschnitt „📝 PDF-Werkzeug aus Workflow-PDF".

---

## 2. Der letzte Bauschritt: Feldarten und die Wahl beim Einlesen (Klaus 2026-09-26)

Klaus: *„sind sie vorausgefüllt, so dass wenn ich auf E-Mail klicke, auch E-Mail angeht
oder wenn ich auf Datum klicke … genauso wie bei Workflow PDF"* und *„zwei
Auswahlmöglichkeiten, einmal mit KI erkennen und einmal … ohne Internet und ohne KI"*.

- **Feldarten** im Originaldokument **und** im Einzeldokument: Text, Datum, E-Mail,
  Telefon, Internet, Unterschrift (dazu Kästchen und QR).
- Die Art wird **aus der Beschriftung vorgeschlagen** (`typAusLabel` in `werkzeug.js`).
  Unter „✏️ Felder positionieren" lässt sie sich je Feld ändern (`ovTypWahl`).
- **Datum** öffnet den Kalender des Geräts (`#ovDatePick`) und speichert TT.MM.JJJJ wie
  der Auftrag.
- **E-Mail, Telefon und Internet** öffnen die passende Tastatur.
- **Unterschrift** wird mit dem Finger gezeichnet und als PNG gespeichert. Sie geht mit in
  den Druck und bleibt aus QR-Code und Link des Auftrags heraus (`ohneBilder()` in
  `compactAuftrag`, sonst würde der Code zu groß).
- **Nach dem Einlesen fragt die App** (`erkennenDialog`): „ohne Internet erkennen",
  „mit KI erkennen" oder „keine — Felder selbst setzen". Vorher erkannte sie still offline.

---

## 3. Stand der Zahlen (für die nächste Änderung)

| | Wert auf `main` |
|---|---|
| Workflow-PDF `CACHE_VERSION` | `workfloh-pdf-v28` |
| Workflow-PDF `uebersetzung.js` | `?v=10` |
| Mein-WorkFloh `CACHE` | `workfloh-v158` |
| Tomys WorkFloh `CACHE` | `tomy-workfloh-v22` |
| `werkzeug.js` (beide WorkFlohs) | `?v=14` |
| übrige `assets/wfpdf/*` (beide) | `?v=12` (= `VER` in `werkzeug.js`) |

**Wer eine dieser Dateien ändert, erhöht die Nummer und die Cache-Version.**

Zwei Dateien müssen außerdem parallel bleiben:

- `uebersetzung.js` wird **byte-1:1** aus Workflow-PDF in beide WorkFlohs kopiert. In
  Mein-WorkFloh pinnt `test/smoke.test.js` sie per SHA; der Pin muss mitgezogen werden.
- `werkzeug.js` ist in beiden WorkFlohs **identisch**.

---

## 4. Was gemessen ist

- **Workflow-PDF** `npm test`: alle Proben grün (Syntax, Browser, Übersetzen, Layout,
  Behörde, Chrome-Nachstellung, Sprache, Schrift, Beispiele).
- **Mein-WorkFloh**: `npm test` 13 bestanden, 0 fehlgeschlagen;
  `scripts/browser_pdf.mjs` **82 grün**.
- **Tomys-Hub**: `tests/browser_pdf.mjs` **82 grün**.
- Alle Proben laufen nur mit **erfundenen** Daten (Musterstadt).

⚠ **Zwei Tomys-Proben sind rot, auf `main` genauso:** `smoke-verbund` und
`smoke-spore-download`. Der Ausgangs-Proxy des Sitzungs-Behälters sperrt das Relais. Das
kommt nicht aus dieser Arbeit und ist nicht behoben.

---

## 5. Was NICHT gemessen ist — wartet auf Klaus' Tablet

- Kalender-Auswahl und Unterschrift mit dem Finger, in beiden WorkFlohs.
- Die Wahl „ohne Internet / mit KI" beim Einlesen, am echten Formular.
- Der Aufbau der Übersetzung auf Klaus' echtem Formular **nach** #29 (Beschriftungs-Spalten,
  Farbe). Gemessen ist das nur an einem erfundenen Formular.
- Die Dateinamen in der Akte (#213).
- **Chromes Übersetzung selbst.** Headless-Chromium hat weder `Translator` noch Chromes
  Seitenübersetzung, `tests/chrome.mjs` stellt sie nach. Den Weg Teilen → Chrome → ⟳ zurück
  hat Klaus am Tablet bestätigt; die Qualität der Übersetzung ist nicht gemessen.

---

## 6. Bekannte Grenzen (bewusst, nicht vergessen)

- **In den WorkFlohs** hält die Übersetzung ihren Zwischenstand nur im Speicher. Lange
  Handbücher gehören ins große Werkzeug (Workflow-PDF), das nach dem Schließen fortsetzt.
- **Die Texterkennung für Scans** (21 MB) liegt nur in Workflow-PDF `vendor/tesseract/`.
  Die WorkFlohs laden sie von dort. Lädt sie nicht, bleiben Scan-Seiten stehen, und die App
  sagt das.
- **Die App kann Deutsch und Englisch nicht an der Schrift unterscheiden** — beide sind
  lateinisch. Das betrifft die Prüfung, ob Chrome in die richtige Zielsprache übersetzt hat.
- **Die Oberflächen-Sprachen (#28) gibt es nur in Workflow-PDF**, nicht in den WorkFlohs.

---

## 7. Richtigstellungen zu älteren Dokumenten in diesem Ordner

- `ABSCHLUSS_2026-09-25_uebersetzung.md` sagt, Kyrillisch werde „als Teilmenge
  eingebettet". **Das gilt nicht mehr:** seit #18 ist es `subset: false`, weil die
  Teilmenge Buchstaben verlor. `tests/schrift.mjs` misst das.
- `BRIEF_uebersetzung-am-geraet.md` ist **größtenteils erledigt**:
  - Der Tablet-Browser hat die `Translator`-Schnittstelle nicht. Die Antwort darauf ist der
    Chrome-Weg (#17, #21 bis #27).
  - Die Befunde aus Klaus' Sichttest am echten Formular sind umgesetzt (#20, #24, #26, #29).
  - **Offen** ist nur noch dieser Punkt daraus: *„PDF bauen dauert 99 s bei 400 Seiten —
    erst messen, dann ändern."* Seit `subset: false` wird dabei keine Teilmenge mehr gebaut;
    die Zeit ist danach nicht neu gemessen worden.
- `BRIEF_uebersetzung.md` war der Bauauftrag für #14 und ist erledigt.

---

## 8. Stundennachweis

Gemessen an den Commits dieser Sitzung (Kennung `session_01DZe6Eq8AWfcw1tftDbCNWx`) in den
drei Repos: **2026-09-25 18:46 UTC bis 2026-09-26 01:25 UTC, also 6 h 39 min.**

- Die Zahl ist eine **Untergrenze**. Die Zeit vor dem ersten Commit hinterlässt keine Spur;
  der Arbeitsbeginn am Zweig laut Reflog war 18:14 UTC.
- Klaus' Pausen darin sind nicht abgezogen.
